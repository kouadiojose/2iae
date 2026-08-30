import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface Message {
  id: string;
  content: string;
  isBot: boolean;
  timestamp: Date;
}

interface ChatbotProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function Chatbot({ isOpen, onToggle }: ChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      content: "Bonjour et bienvenue au Groupe 2IAE, l'École des Entrepreneurs 👋 Je suis votre conseiller d'orientation. Vous vous renseignez pour vous-même ou pour votre enfant ?",
      isBot: true,
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [sessionId] = useState(() => `session-${Date.now()}-${Math.random()}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Collecte des coordonnées en début de discussion : le mini-formulaire
  // disparaît dès qu'il est rempli ou passé, et n'est montré qu'une fois.
  const [contactCollecte, setContactCollecte] = useState(false);
  const [leadPhone, setLeadPhone] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadEnvoi, setLeadEnvoi] = useState(false);

  const envoyerLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadPhone.trim() && !leadEmail.trim()) return;
    setLeadEnvoi(true);
    try {
      await apiRequest("/api/leads", "POST", {
        phone: leadPhone.trim() || undefined,
        email: leadEmail.trim() || undefined,
        source: "chatbot",
        sessionId,
      });
      setMessages(prev => [...prev, {
        id: `lead-${Date.now()}`,
        content: "Merci ! Un conseiller vous recontactera très vite. En attendant, je réponds à toutes vos questions 😊",
        isBot: true,
        timestamp: new Date()
      }]);
    } catch {
      // Sans gravité : la conversation continue, l'assistant redemandera.
    } finally {
      setLeadEnvoi(false);
      setContactCollecte(true);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest("/api/chat", "POST", {
        message,
        sessionId
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        const botMessage: Message = {
          id: `bot-${Date.now()}`,
          content: data.response,
          isBot: true,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botMessage]);
      }
    },
    onError: () => {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        content: "Désolé, une erreur s'est produite. Veuillez réessayer.",
        isBot: true,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputMessage.trim() || chatMutation.isPending) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content: inputMessage,
      isBot: false,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    chatMutation.mutate(inputMessage);
    setInputMessage("");
  };

  if (!isOpen) {
    return (
      <Button
        onClick={onToggle}
        className="fixed bottom-6 right-6 w-16 h-16 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg z-50"
        data-testid="button-chatbot-open"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 w-96 h-[500px] shadow-xl z-50 flex flex-col overflow-hidden" data-testid="chatbot-window">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg" data-testid="chatbot-title">Assistant 2IAE</CardTitle>
              <p className="text-sm text-muted-foreground" data-testid="chatbot-status">En ligne</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="h-8 w-8 p-0"
            data-testid="button-chatbot-close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 px-4 overflow-hidden" data-testid="chatbot-messages">
          <div className="space-y-4 pb-4 max-w-full overflow-hidden">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start space-x-2 ${
                  message.isBot ? "justify-start" : "justify-end"
                }`}
                data-testid={`message-${message.isBot ? "bot" : "user"}-${message.id}`}
              >
                {message.isBot && (
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
                
                <div
                  className={`max-w-[75%] rounded-lg px-3 py-2 text-sm break-words overflow-wrap-anywhere ${
                    message.isBot
                      ? "bg-muted text-foreground"
                      : "bg-primary text-primary-foreground"
                  }`}
                  style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
                >
                  <p className="whitespace-pre-wrap break-words overflow-wrap-anywhere" style={{ wordBreak: "break-word" }}>{message.content}</p>
                  <p className={`text-xs mt-1 opacity-70`}>
                    {message.timestamp.toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </p>
                </div>

                {!message.isBot && (
                  <div className="w-6 h-6 bg-secondary rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <User className="h-3 w-3 text-secondary-foreground" />
                  </div>
                )}
              </div>
            ))}
            
            {chatMutation.isPending && (
              <div className="flex items-start space-x-2" data-testid="chatbot-typing">
                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="h-3 w-3 text-primary-foreground" />
                </div>
                <div className="bg-muted rounded-lg px-3 py-2 text-sm">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                  </div>
                </div>
              </div>
            )}
            
            {!contactCollecte && (
              <div className="bg-muted rounded-lg p-3 space-y-2" data-testid="chatbot-lead-form">
                <p className="text-xs font-semibold text-foreground">
                  Laissez vos coordonnées, un conseiller vous rappelle gratuitement :
                </p>
                <form onSubmit={envoyerLead} className="space-y-2">
                  <Input
                    value={leadPhone}
                    onChange={(e) => setLeadPhone(e.target.value)}
                    placeholder="Numéro WhatsApp / téléphone"
                    type="tel"
                    className="h-8 text-sm bg-white"
                    data-testid="input-lead-phone"
                  />
                  <Input
                    value={leadEmail}
                    onChange={(e) => setLeadEmail(e.target.value)}
                    placeholder="E-mail (facultatif)"
                    type="email"
                    className="h-8 text-sm bg-white"
                    data-testid="input-lead-email"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={leadEnvoi || (!leadPhone.trim() && !leadEmail.trim())}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground h-8"
                      data-testid="button-lead-submit"
                    >
                      Être rappelé
                    </Button>
                    <button
                      type="button"
                      onClick={() => setContactCollecte(true)}
                      className="text-xs text-muted-foreground underline"
                      data-testid="button-lead-skip"
                    >
                      Plus tard
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <form onSubmit={handleSendMessage} className="p-4 border-t" data-testid="chatbot-form">
          <div className="flex space-x-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Tapez votre message..."
              disabled={chatMutation.isPending}
              className="flex-1"
              data-testid="input-chatbot-message"
            />
            <Button
              type="submit"
              disabled={!inputMessage.trim() || chatMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              data-testid="button-chatbot-send"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}