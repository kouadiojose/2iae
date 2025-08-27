import { useState } from "react";
import Chatbot from "./chatbot";

export default function ChatbotWidget() {
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);

  const toggleChatbot = () => {
    setIsChatbotOpen(!isChatbotOpen);
  };

  return (
    <Chatbot 
      isOpen={isChatbotOpen} 
      onToggle={toggleChatbot} 
    />
  );
}