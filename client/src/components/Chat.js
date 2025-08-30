import React, { useState, useRef, useEffect } from 'react';
import './Chat.css';

const Chat = ({ messages, onSendMessage }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [showNewMessage, setShowNewMessage] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Show new message indicator when chat is closed
  useEffect(() => {
    if (!isOpen && messages.length > 0) {
      setShowNewMessage(true);
      const timer = setTimeout(() => setShowNewMessage(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [messages, isOpen]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
    setShowNewMessage(false);
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className={`chat-container ${isOpen ? 'chat-open' : 'chat-closed'}`}>
      <div 
        className="chat-toggle" 
        onClick={toggleChat}
      >
        <span className="chat-icon">💬</span>
        {showNewMessage && !isOpen && <span className="new-message-indicator">!</span>}
        <span className="chat-label">{isOpen ? 'Hide Chat' : 'Show Chat'}</span>
      </div>
      
      {isOpen && (
        <div className="chat-content">
          <div className="chat-header">
            <h3>Chat</h3>
          </div>
          
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="no-messages">No messages yet...</div>
            ) : (
              messages.map((msg, index) => (
                <div key={index} className="chat-message">
                  <span className="message-time">[{formatTime(msg.timestamp)}]</span>
                  <span className="message-player">Player {msg.playerId?.slice(0, 6)}:</span>
                  <span className="message-text">{msg.message}</span>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <form className="chat-input-form" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="chat-input"
              maxLength={200}
            />
            <button type="submit" className="chat-send-btn">
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default Chat;