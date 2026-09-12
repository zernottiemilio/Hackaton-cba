import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Tipo mínimo de la Web Speech API. No está tipado en lib.dom porque
 * todavía es no-estándar / Webkit en algunos browsers.
 */
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[] & { length: number } }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

type Ctor = new () => SpeechRecognitionLike;

function obtenerCtorReconocimiento(): Ctor | null {
  if (typeof window === 'undefined') return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as Ctor | null;
}

/** Devuelve el primer mimeType de audio soportado por MediaRecorder. */
function mejorMimeAudio(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  const candidatos = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  for (const m of candidatos) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return 'audio/webm';
}

export interface DictadoResultado {
  /** Blob del audio grabado. null si no había micro o se canceló. */
  audio: Blob | null;
  /** Texto transcrito por la Web Speech API. Puede ser vacío. */
  texto: string;
}

interface UseDictadoResult {
  soportaTranscripcion: boolean;
  soportaGrabacion: boolean;
  grabando: boolean;
  /** Texto acumulado mientras se va dictando. */
  textoEnVivo: string;
  /** Empieza dictado: pide mic, arranca transcripción + MediaRecorder. */
  iniciar: () => Promise<void>;
  /** Detiene y devuelve { audio, texto } final. */
  detener: () => Promise<DictadoResultado>;
  /** Aborta sin devolver nada (descarta el audio). */
  cancelar: () => void;
  resetear: () => void;
  error: string | null;
}

/**
 * Dictado por voz combinado con grabación de la nota. Web Speech API hace
 * la transcripción (es-AR) y MediaRecorder captura el audio en paralelo
 * para poder reproducirlo después en el chat.
 *
 * Si el browser no soporta SpeechRecognition (Firefox), la grabación
 * sigue funcionando y se devuelve texto vacío.
 */
export function useDictado(): UseDictadoResult {
  const [grabando, setGrabando] = useState(false);
  const [textoFinal, setTextoFinal] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const textoAlDetenerRef = useRef('');

  const soportaTranscripcion = !!obtenerCtorReconocimiento();
  const soportaGrabacion =
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices !== 'undefined' &&
    typeof MediaRecorder !== 'undefined';

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      try { recRef.current?.abort(); } catch { /* ignore */ }
      try { mediaRef.current?.stop(); } catch { /* ignore */ }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const iniciar = useCallback(async () => {
    setError(null);
    setInterim('');
    setTextoFinal('');
    textoAlDetenerRef.current = '';
    chunksRef.current = [];

    if (!soportaGrabacion) {
      setError('Tu navegador no permite grabar audio');
      return;
    }

    // 1) Stream del micrófono
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name = (err as Error).name;
      setError(name === 'NotAllowedError' ? 'not-allowed' : (name || 'No se pudo abrir el mic'));
      return;
    }
    streamRef.current = stream;

    // 2) MediaRecorder para el blob
    const mimeType = mejorMimeAudio();
    const rec = new MediaRecorder(stream, { mimeType });
    mediaRef.current = rec;
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.start();

    // 3) Reconocimiento (opcional)
    const Ctor = obtenerCtorReconocimiento();
    if (Ctor) {
      const r = new Ctor();
      r.lang = 'es-AR';
      r.continuous = true;
      r.interimResults = true;
      r.onresult = (e) => {
        let finalChunk = '';
        let interimChunk = '';
        for (let i = e.resultIndex; i < e.results.length; i += 1) {
          const res = e.results[i];
          const t = res[0].transcript;
          if (res.isFinal) finalChunk += t;
          else interimChunk += t;
        }
        if (finalChunk) {
          setTextoFinal((prev) => (prev ? prev + ' ' : '') + finalChunk.trim());
        }
        setInterim(interimChunk);
      };
      r.onerror = (e) => {
        // 'no-speech' es ruido común si arranca el mic y nadie habla
        if (e.error !== 'no-speech' && e.error !== 'aborted') setError(e.error);
      };
      r.onend = () => setInterim('');
      try {
        r.start();
        recRef.current = r;
      } catch (err) {
        setError((err as Error).message || 'No se pudo iniciar el dictado');
      }
    }

    setGrabando(true);
  }, [soportaGrabacion]);

  const detener = useCallback((): Promise<DictadoResultado> => {
    setGrabando(false);

    // Guardamos el texto AHORA, antes de cerrar el reconocedor.
    textoAlDetenerRef.current = (textoFinal + (interim ? ' ' + interim : '')).trim();

    try { recRef.current?.stop(); } catch { /* ignore */ }

    const rec = mediaRef.current;
    if (!rec) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      return Promise.resolve({ audio: null, texto: textoAlDetenerRef.current });
    }

    return new Promise<DictadoResultado>((resolve) => {
      rec.onstop = () => {
        const mime = rec.mimeType || mejorMimeAudio();
        const blob = chunksRef.current.length > 0
          ? new Blob(chunksRef.current, { type: mime })
          : null;
        // Liberar mic
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        mediaRef.current = null;
        resolve({ audio: blob, texto: textoAlDetenerRef.current });
      };
      try { rec.stop(); } catch {
        // Ya estaba detenido — armamos el blob con lo que haya
        const mime = rec.mimeType || mejorMimeAudio();
        const blob = chunksRef.current.length > 0
          ? new Blob(chunksRef.current, { type: mime })
          : null;
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        mediaRef.current = null;
        resolve({ audio: blob, texto: textoAlDetenerRef.current });
      }
    });
  }, [textoFinal, interim]);

  const cancelar = useCallback(() => {
    setGrabando(false);
    try { recRef.current?.abort(); } catch { /* ignore */ }
    try { mediaRef.current?.stop(); } catch { /* ignore */ }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRef.current = null;
    recRef.current = null;
    chunksRef.current = [];
    setTextoFinal('');
    setInterim('');
  }, []);

  const resetear = useCallback(() => {
    setTextoFinal('');
    setInterim('');
    setError(null);
  }, []);

  const textoEnVivo = (textoFinal + (interim ? ' ' + interim : '')).trim();

  return {
    soportaTranscripcion,
    soportaGrabacion,
    grabando,
    textoEnVivo,
    iniciar,
    detener,
    cancelar,
    resetear,
    error,
  };
}
