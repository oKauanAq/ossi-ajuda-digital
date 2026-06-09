import base64
import binascii
import json
import os
import tempfile
import wave
from http.server import BaseHTTPRequestHandler

ERRO_PADRAO = 'Não consegui entender o áudio. Tente gravar novamente ou escreva sua dúvida.'
CODIGOS_ERRO_SEGUROS = {
    'payload_vazio',
    'payload_muito_grande',
    'json_invalido',
    'mime_invalido',
    'audio_base64_ausente',
    'base64_invalido',
    'audio_muito_grande',
    'wav_invalido',
    'wav_precisa_ser_pcm_16_mono',
    'sample_rate_invalido',
    'audio_vazio',
    'nvidia_api_key_ausente',
    'riva_import_erro',
    'nvidia_grpc_erro',
    'sem_transcricao',
    'erro_desconhecido',
}
MAX_AUDIO_BYTES = 1_500_000
NVIDIA_SERVER = 'grpc.nvcf.nvidia.com:443'
NVIDIA_FUNCTION_ID = 'b0e8b4a5-217c-40b7-9b96-17d84e666317'
LANGUAGE_CODE = 'pt-BR'


class ErroTranscricao(Exception):
    def __init__(self, codigo):
        super().__init__(codigo)
        self.codigo = codigo if codigo in CODIGOS_ERRO_SEGUROS else 'erro_desconhecido'


def _codigo_seguro(codigo):
    return codigo if codigo in CODIGOS_ERRO_SEGUROS else 'erro_desconhecido'


def _codigo_de_excecao(exc):
    if isinstance(exc, ErroTranscricao):
        return exc.codigo
    if isinstance(exc, (ValueError, RuntimeError)) and exc.args:
        return _codigo_seguro(str(exc.args[0]))
    return 'erro_desconhecido'


def _json_response(handler, status, payload):
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    handler.send_response(status)
    handler.send_header('Content-Type', 'application/json; charset=utf-8')
    handler.send_header('Cache-Control', 'no-store, max-age=0')
    handler.send_header('Pragma', 'no-cache')
    handler.send_header('Content-Length', str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def _erro(handler, status=400, codigo='erro_desconhecido'):
    _json_response(
        handler,
        status,
        {'ok': False, 'erro': ERRO_PADRAO, 'codigo': _codigo_seguro(codigo)},
    )


def _ler_json(handler):
    try:
        tamanho = int(handler.headers.get('content-length') or '0')
    except ValueError as exc:
        raise ErroTranscricao('payload_vazio') from exc
    if tamanho <= 0:
        raise ErroTranscricao('payload_vazio')
    if tamanho > (MAX_AUDIO_BYTES * 2):
        raise ErroTranscricao('payload_muito_grande')
    corpo = handler.rfile.read(tamanho)
    try:
        payload = json.loads(corpo.decode('utf-8'))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ErroTranscricao('json_invalido') from exc
    if not isinstance(payload, dict):
        raise ErroTranscricao('payload_vazio')
    return payload


def _extrair_wav(audio_bytes):
    try:
        with tempfile.NamedTemporaryFile(dir='/tmp', suffix='.wav', delete=True) as arquivo:
            arquivo.write(audio_bytes)
            arquivo.flush()
            with wave.open(arquivo.name, 'rb') as wav:
                canais = wav.getnchannels()
                sample_width = wav.getsampwidth()
                sample_rate = wav.getframerate()
                comp_type = wav.getcomptype()
                frames = wav.readframes(wav.getnframes())
    except (wave.Error, EOFError, OSError) as exc:
        raise ErroTranscricao('wav_invalido') from exc

    if canais != 1 or sample_width != 2 or comp_type != 'NONE':
        raise ErroTranscricao('wav_precisa_ser_pcm_16_mono')
    if sample_rate < 8000 or sample_rate > 48000:
        raise ErroTranscricao('sample_rate_invalido')
    if not frames:
        raise ErroTranscricao('audio_vazio')
    return frames, sample_rate


def _transcrever_com_nvidia(frames, sample_rate):
    api_key = os.environ.get('NVIDIA_API_KEY')
    if not api_key:
        raise RuntimeError('nvidia_api_key_ausente')

    try:
        import riva.client
    except ImportError as exc:
        raise ErroTranscricao('riva_import_erro') from exc

    try:
        auth = riva.client.Auth(
            uri=NVIDIA_SERVER,
            use_ssl=True,
            metadata_args=[
                ['function-id', NVIDIA_FUNCTION_ID],
                ['authorization', f'Bearer {api_key}'],
            ],
        )
        asr = riva.client.ASRService(auth)
        config = riva.client.RecognitionConfig(
            encoding=riva.client.AudioEncoding.LINEAR_PCM,
            sample_rate_hertz=sample_rate,
            language_code=LANGUAGE_CODE,
            max_alternatives=1,
            enable_automatic_punctuation=True,
        )
        resposta = asr.offline_recognize(frames, config)
    except Exception as exc:
        raise ErroTranscricao('nvidia_grpc_erro') from exc

    resultados = getattr(resposta, 'results', []) or []
    if not resultados:
        return ''
    alternativas = getattr(resultados[0], 'alternatives', []) or []
    if not alternativas:
        return ''
    return (getattr(alternativas[0], 'transcript', '') or '').strip()


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-store, max-age=0')
        self.end_headers()

    def do_POST(self):
        try:
            payload = _ler_json(self)
            mime_type = payload.get('mimeType')
            audio_base64 = payload.get('audioBase64')
            if mime_type != 'audio/wav':
                raise ErroTranscricao('mime_invalido')
            if not isinstance(audio_base64, str) or not audio_base64:
                raise ErroTranscricao('audio_base64_ausente')
            try:
                audio_bytes = base64.b64decode(audio_base64, validate=True)
            except (ValueError, binascii.Error) as exc:
                raise ErroTranscricao('base64_invalido') from exc
            if len(audio_bytes) > MAX_AUDIO_BYTES:
                raise ErroTranscricao('audio_muito_grande')
            if not audio_bytes:
                raise ErroTranscricao('audio_vazio')
            frames, sample_rate = _extrair_wav(audio_bytes)
            transcricao = _transcrever_com_nvidia(frames, sample_rate)
            if not transcricao:
                raise ErroTranscricao('sem_transcricao')
            _json_response(self, 200, {'ok': True, 'transcricao': transcricao})
        except Exception as exc:
            codigo = _codigo_de_excecao(exc)
            print(f'[voz/transcrever] erro={codigo}')
            _erro(self, 200, codigo)

    def do_GET(self):
        _erro(self, 405, 'payload_vazio')
