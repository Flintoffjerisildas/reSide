import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Mic, MicOff, Languages, Loader2 } from 'lucide-react';
import { useAI } from '../contexts/AIContext';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';
import { translateText } from '../lib/api';

export default function InputArea() {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const { processMessage, isProcessing } = useAI();
  const { language, setLanguage } = useLanguage();
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        const error = event?.error;
        setIsListening(false);

        let messageEn = 'Voice recognition failed';
        let messageTa = 'குரல் அங்கீகாரம் தோல்வியடைந்தது';

        if (error === 'not-allowed' || error === 'service-not-allowed') {
          messageEn = 'Microphone access was blocked. Please allow mic permission in your browser and try again.';
          messageTa = 'மைக்ரோஃபோன் அனுமதி முடக்கப்பட்டுள்ளது. உலாவியில் அனுமதியை வழங்கி மீண்டும் முயற்சிக்கவும்.';
        } else if (error === 'network') {
          messageEn = 'Network error while using voice recognition. Please check your internet connection.';
          messageTa = 'குரல் அங்கீகாரத்தின் போது நெட்வொர்க் பிழை ஏற்பட்டது. உங்கள் இணைய இணைப்பைச் சரிபார்க்கவும்.';
        } else if (error === 'no-speech') {
          messageEn = 'No speech was detected. Please speak clearly near the microphone.';
          messageTa = 'பேச்சு கண்டறியப்படவில்லை. மைக்ரோஃபோனுக்கு அருகில் தெளிவாக பேசவும்.';
        }

        toast.error(language === 'ta' ? messageTa : messageEn);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [language]);

  const handleSend = async () => {
    if (!input.trim() || isProcessing || isTranslating) return;
    
    const message = input.trim();
    setInput('');

    setIsTranslating(true);
    try {
      const data = await translateText(message, 'en');
      const englishForProcessing =
        typeof data?.englishText === 'string' && data.englishText.trim()
          ? data.englishText
          : data?.translatedText;

      const tamilForDisplay =
        typeof data?.tamilText === 'string' && data.tamilText.trim()
          ? data.tamilText
          : undefined;

      await processMessage(message, {
        translatedText: englishForProcessing,
        displayTranslatedText: language === 'ta' ? tamilForDisplay : englishForProcessing,
        detectedLanguage: data?.detectedLanguage
      });
    } catch {
      toast.error(language === 'ta' ? 'மொழிபெயர்ப்பு தோல்வியடைந்தது' : 'Translation failed');
      await processMessage(message);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      toast.error(language === 'ta' ? 'குரல் அங்கீகாரம் ஆதரிக்கப்படவில்லை' : 'Voice recognition not supported');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.lang = language === 'ta' ? 'ta-IN' : 'en-US';
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const toggleLanguage = () => {
    const newLang = language === 'en' ? 'ta' : 'en';
    setLanguage(newLang);
    toast.success(
      newLang === 'ta' 
        ? 'தமிழ் மொழிக்கு மாற்றப்பட்டது' 
        : 'Switched to English'
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={
            language === 'ta'
              ? 'உங்கள் செய்தியை தட்டச்சு செய்யுங்கள்...'
              : 'Type your message...'
          }
          className="min-h-[60px] resize-none"
          disabled={isProcessing || isTranslating}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={toggleVoiceInput}
            disabled={isProcessing || isTranslating}
            className={isListening ? 'bg-destructive text-destructive-foreground' : ''}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={toggleLanguage}
            disabled={isProcessing || isTranslating}
            title={language === 'en' ? 'Switch to Tamil' : 'Switch to English'}
          >
            <Languages className="h-4 w-4" />
          </Button>
        </div>
        <Button
          onClick={handleSend}
          disabled={!input.trim() || isProcessing || isTranslating}
          size="icon"
        >
          {isTranslating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
