import base64
import json
import os
import tempfile
import wave
from http.server import BaseHTTPRequestHandler

ERRO_PADRAO = 'Não consegui entender o áudio. Tente gravar novamente ou escreva sua dúvida.'
MAX_AUDIO_BYTES = 1_500_000
NVIDIA_SERVER = 'grpc.nvcf.nvidia.com:443'
NVIDIA_FUNCTION_ID = 'b0e8b4a5-217c-40b7-9b96-17d84e666317'
LANGUAGE_CODE = 'pt-BR'


def _json_response(handler, status, payload):
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    handler.send_response(status)
    handler.send_header('Content-Type', 'application/json; charset=utf-8')
    handler.send_header('Cache-Control', 'no-store, max-age=0')
    handler.send_header('Pragma', 'no-cache')
    handler.send_header('Content-Length', str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def _erro(handler, status=400):
    _json_response(handler, status, {'ok': False, 'erro': ERRO_PADRAO})


def _ler_json(handler):
    tamanho = int(handler.headers.get('content-length') or '0')
    if tamanho <= 0 or tamanho > (MAX_AUDIO_BYTES * 2):
        raise ValueError('payload_invalido')
    corpo = handler.rfile.read(tamanho)
    return json.loads(corpo.decode('utf-8'))


def _extrair_wav(audio_bytes):
    with tempfile.NamedTemporaryFile(dir='/tmp', suffix='.wav', delete=True) as arquivo:
        arquivo.write(audio_bytes)
        arquivo.flush()
        with wave.open(arquivo.name, 'rb') as wav:
            canais = wav.getnchannels()
            sample_width = wav.getsampwidth()
            sample_rate = wav.getframerate()
            frames = wav.readframes(wav.getnframes())

    if canais != 1 or sample_width != 2:
        raise ValueError('wav_precisa_ser_pcm_16_mono')
    if sample_rate < 8000 or sample_rate > 48000:
        raise ValueError('sample_rate_invalido')
    if not frames:
        raise ValueError('audio_vazio')
    return frames, sample_rate


def _transcrever_com_nvidia(frames, sample_rate):
    api_key = os.environ.get('NVIDIA_API_KEY')
    if not api_key:
        raise RuntimeError('nvidia_api_key_ausente')

    import riva.client

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
            if mime_type != 'audio/wav' or not isinstance(audio_base64, str):
                raise ValueError('payload_invalido')
            audio_bytes = base64.b64decode(audio_base64, validate=True)
            if not audio_bytes or len(audio_bytes) > MAX_AUDIO_BYTES:
                raise ValueError('audio_muito_grande')
            frames, sample_rate = _extrair_wav(audio_bytes)
            transcricao = _transcrever_com_nvidia(frames, sample_rate)
            if not transcricao:
                raise ValueError('sem_transcricao')
            _json_response(self, 200, {'ok': True, 'transcricao': transcricao})
        except Exception:
            _erro(self, 200)

    def do_GET(self):
        _erro(self, 405)
