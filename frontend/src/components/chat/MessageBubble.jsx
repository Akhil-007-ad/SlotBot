import React from 'react';

const formatMessageText = (text) => {
  if (!text) return '';

  // Replace double asterisks with bold tags
  let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Replace newlines with break lines
  formatted = formatted.replace(/\n/g, '<br />');

  return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
};

const MessageBubble = ({ message }) => {
  const isUser = message.sender === 'user';
  const isSystem = message.sender === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center w-full my-3">
        <div className="text-xs text-slate-500 bg-slate-200 px-3 py-1 rounded border border-slate-200">
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-2.5 my-1.5 w-full items-end animate-fade-in ${isUser ? 'justify-end' : 'justify-start'}`}>
      {/* Bot avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100/80 flex items-center justify-center text-base mb-0.5 shrink-0">
          🤖
        </div>
      )}

      {/* Bubble */}
      <div
        className={[
          "px-3.5 py-2.5 max-w-[75%] text-sm leading-[1.45] break-words",
          isUser
            ? "bg-blue-600 text-white border border-blue-600/10 shadow-[0_4px_10px_rgba(37,99,235,0.15)] rounded-[12px_12px_2px_12px]"
            : "bg-slate-100 text-slate-900 border border-slate-200 rounded-[12px_12px_12px_2px]"
        ].join(' ')}
      >
        {message.isTyping ? (
          <div className="flex gap-1 items-center h-3.5 px-1 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block typing-dot-1" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block typing-dot-2" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block typing-dot-3" />
          </div>
        ) : (
          <div className="block">{formatMessageText(message.text)}</div>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-base mb-0.5 shrink-0">
          👤
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
