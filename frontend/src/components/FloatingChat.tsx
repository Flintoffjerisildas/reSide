import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MessageCircle, X, Minimize2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useGetCallerUserProfile, useIsCallerApproved } from '../hooks/useQueries';
import ChatInterface from './ChatInterface';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const { user } = useAuth();
  const { data: userProfile } = useGetCallerUserProfile();
  const { data: isApproved } = useIsCallerApproved();
  
  const isAuthenticated = !!user;
  
  const handleToggle = () => {
    setIsOpen(true);
    setIsMinimized(false);
  };

  const handleMinimize = () => {
    setIsMinimized(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsMinimized(false);
  };

  return (
    <>
      {/* Floating Chat Button */}
      {(!isOpen || isMinimized) && (
        <Button
          onClick={handleToggle}
          size="icon"
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 h-12 w-12 sm:h-14 sm:w-14 rounded-full shadow-lg transition-transform hover:scale-110 touch-manipulation"
        >
          <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />
          <span className="sr-only">Open AI Assistant</span>
        </Button>
      )}

      {/* Floating Chat Window */}
      {isOpen && !isMinimized && (
        <Card className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col overflow-hidden shadow-2xl w-[calc(100vw-2rem)] sm:w-[400px] h-[calc(100vh-8rem)] sm:h-[600px] max-h-[600px]">
          {/* Chat Header */}
          <div className="flex items-center justify-between border-b border-border bg-primary px-3 sm:px-4 py-2 sm:py-3 text-primary-foreground flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-primary-foreground/20">
                <span className="text-base sm:text-lg">🤖</span>
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-semibold">AI Assistant</h3>
                <p className="text-[10px] sm:text-xs opacity-90">AI உதவியாளர்</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleMinimize}
                className="h-7 w-7 sm:h-8 sm:w-8 text-primary-foreground hover:bg-primary-foreground/20 touch-manipulation"
              >
                <Minimize2 className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="sr-only">Minimize</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="h-7 w-7 sm:h-8 sm:w-8 text-primary-foreground hover:bg-primary-foreground/20 touch-manipulation"
              >
                <X className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </div>

          {/* Chat Content */}
          <ChatInterface />
        </Card>
      )}
    </>
  );
}
