import { useEffect, useRef } from 'react';
import { useAI } from '../contexts/AIContext';
import PropertyCard from './PropertyCard';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User, Bot } from 'lucide-react';

export default function MessageList() {
  const { messages } = useAI();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          {message.role === 'assistant' && (
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarFallback className="bg-primary text-primary-foreground">
                <Bot className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
          )}
          
          <div className={`flex max-w-[85%] flex-col gap-2 ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className={`rounded-2xl px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'glass-surface text-foreground shadow-sm'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
            </div>

            {message.role === 'user' &&
              typeof (message.displayTranslatedText || message.translatedText) === 'string' &&
              String(message.displayTranslatedText || message.translatedText).trim() &&
              String(message.displayTranslatedText || message.translatedText).trim() !== message.content.trim() && (
                <div className="rounded-2xl glass-surface px-4 py-2 shadow-xs">
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                    {message.displayTranslatedText || message.translatedText}
                  </p>
                </div>
              )}
            
            {message.properties && message.properties.length > 0 && (
              <div className="w-full space-y-2">
                {message.properties.map((property) => (
                  <PropertyCard key={property.id.toString()} property={property} compact />
                ))}
              </div>
            )}
          </div>

          {message.role === 'user' && (
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarFallback className="bg-accent text-accent-foreground">
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}
