import React, { useState, useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble';
import ConfirmationCard from './ConfirmationCard';

const QUICK_SUGGESTIONS = [
  "Book a room for 4 people",
  "Book a room for 6 people",
  "Restart booking"
];

const ConflictResolutionCard = ({ bookingData, onSendMessage, onCancel }) => {
  const { recommendedStartTimeStr, durationHours, conflictReason } = bookingData;

  const formatTimeStr = (timeStr) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const getEndTimeStr = (timeStr, duration) => {
    if (!timeStr || !duration) return '';
    const [hours, minutes] = timeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    const end = new Date(d.getTime() + duration * 60 * 60 * 1000);
    return end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  return (
    <div className="animate-fade-in flex flex-col gap-4 p-5 rounded-xl bg-white border border-rose-200 shadow-[0_4px_12px_rgba(244,63,94,0.08)] my-3 max-w-100">
      <div className="flex flex-col gap-1">
        <span className="self-start text-[0.7rem] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded uppercase tracking-wide">
          ⚠️ Timing Conflict
        </span>
        <h3 className="text-base font-bold text-slate-900">Choose Option</h3>
      </div>

      <div className="text-xs text-slate-600 leading-relaxed py-2 border-t border-b border-slate-100">
        <p className="font-semibold text-rose-700 mb-1">Conflict details:</p>
        <p>{conflictReason || 'Some attendees are busy.'}</p>

        {recommendedStartTimeStr ? (
          <div className="mt-3 p-2.5 bg-emerald-50 rounded-lg border border-emerald-100 animate-fade-in">
            <p className="font-semibold text-emerald-800 mb-1">Recommended Free Slot:</p>
            <p className="text-emerald-700 font-medium">
              ⏰ {formatTimeStr(recommendedStartTimeStr)} – {getEndTimeStr(recommendedStartTimeStr, durationHours)}
            </p>
          </div>
        ) : (
          <p className="text-slate-500 italic mt-2">No other free slot is available today for all attendees.</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {recommendedStartTimeStr && (
          <button
            onClick={() => onSendMessage('1')}
            className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm cursor-pointer shadow-[0_4px_12px_rgba(16,185,129,0.2)] transition-all duration-200 hover:-translate-y-0.5"
          >
            Confirm the new change
          </button>
        )}
        <button
          onClick={() => onSendMessage('2')}
          className="w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold text-sm cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
        >
          Continue anyway
        </button>
        <button
          onClick={onCancel}
          className="w-full py-2.5 px-4 rounded-lg border border-slate-200 bg-white text-slate-500 font-medium text-sm cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-400"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

const ChatWindow = ({ messages, isTyping, onSendMessage, session, onConfirmBooking, onCancelBooking, apiFetch, isAdmin }) => {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [mentionQuery, setMentionQuery] = useState(null);
  const [employeeSearchLoading, setEmployeeSearchLoading] = useState(false);
  const [employeeSearchError, setEmployeeSearchError] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [mentionTriggerIndex, setMentionTriggerIndex] = useState(-1);
  const [selectedRoomName, setSelectedRoomName] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Sync selectedRoomName with session state
  useEffect(() => {
    if (session?.bookingData?.roomName) {
      setSelectedRoomName(session.bookingData.roomName);
    } else {
      setSelectedRoomName(null);
    }
  }, [session]);

  // Outlook-style server-side people search. Searching on the backend avoids
  // limiting mentions to the first page of directory users.
  useEffect(() => {
    if (!apiFetch || mentionQuery === null) return;

    let active = true;
    const timer = setTimeout(async () => {
      setEmployeeSearchLoading(true);
      setEmployeeSearchError('');

      try {
        const res = await apiFetch(`/api/chat/employees?q=${encodeURIComponent(mentionQuery)}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || `Directory search failed (${res.status})`);
        }

        const employeeList = Array.isArray(data)
          ? data
          : (data.employees || []);
        if (active) {
          setSuggestions(employeeList);
          setActiveSuggestionIndex(0);
        }
      } catch (err) {
        if (active) {
          setSuggestions([]);
          setEmployeeSearchError(err.message);
        }
      } finally {
        if (active) setEmployeeSearchLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [apiFetch, mentionQuery]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    onSendMessage(inputValue.trim());
    setInputValue('');
    setShowSuggestions(false);
    setMentionQuery(null);
  };

  const handleSuggestionClick = (suggestion) => {
    onSendMessage(suggestion);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);

    const lastAtIdx = val.lastIndexOf('@');
    if (lastAtIdx !== -1) {
      const afterAt = val.substring(lastAtIdx + 1);
      if (!afterAt.includes(',')) {
        const query = afterAt.trim();
        setMentionQuery(query);
        setShowSuggestions(true);
        setMentionTriggerIndex(lastAtIdx);
        setActiveSuggestionIndex(0);
        return;
      }
    }
    setShowSuggestions(false);
    setSuggestions([]);
    setMentionQuery(null);
  };

  const selectSuggestion = (employee) => {
    const beforeAt = inputValue.substring(0, mentionTriggerIndex);
    const newVal = beforeAt + employee.email + ', ';
    setInputValue(newVal);
    setShowSuggestions(false);
    setSuggestions([]);
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSuggestionIndex(prev => (prev + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSuggestionIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        selectSuggestion(suggestions[activeSuggestionIndex]);
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
        setMentionQuery(null);
      }
    }
  };

  const showConfirmationCard = session?.step === 'AWAITING_CONFIRMATION' && session?.bookingData;
  const showConflictCard = session?.step === 'AWAITING_CONFLICT_RESOLUTION' && session?.bookingData;

  // Disable normal text input when selecting a room or acting on cards
  const showRoomCardsStep = session?.step === 'AWAITING_ROOM_SELECTION';
  const isAwaitingDate = session?.expectedField === 'date';
  const disableInput = showConfirmationCard || showConflictCard || showRoomCardsStep;

  const formatDateInput = date => [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
  const minimumDate = formatDateInput(new Date());
  const maximumDateValue = new Date();
  maximumDateValue.setDate(maximumDateValue.getDate() + (isAdmin ? 7 : 1));
  const maximumDate = formatDateInput(maximumDateValue);

  useEffect(() => {
    if (!isAwaitingDate) setSelectedDate('');
  }, [isAwaitingDate]);

  // Track the last bot message to allow room selections only on the latest query
  const botMessages = messages.filter(m => m.sender === 'bot');
  const lastBotMessageId = botMessages[botMessages.length - 1]?.id;

  return (
    <div className="flex flex-col h-[calc(100vh-110px)] rounded-xl border border-slate-200 shadow-[0_2px_6px_rgba(0,0,0,0.06),0_8px_20px_rgba(0,0,0,0.08),0_20px_40px_rgba(0,0,0,0.10)] overflow-hidden bg-white relative">

      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 bg-white shrink-0">
        <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xl shrink-0">
          🤖
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900">SlotBot Assistant</h2>
          <p className="text-xs text-emerald-600">● Online | Today, Tomorrow &amp; Admin Advance Bookings</p>
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 p-5 bg-white">
        {messages.map(msg => (
          <React.Fragment key={msg.id}>
            <MessageBubble message={msg} />

            {/* Dynamic Clickable Room Selection Cards */}
            {msg.roomsList && msg.roomsList.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full pl-[42px] my-3">
                {msg.roomsList.map(r => {
                  const isSelected = selectedRoomName === r.name;
                  return (
                    <div
                      key={r.id}
                      onClick={() => {
                        const isActive = msg.id === lastBotMessageId;
                        if (isActive) {
                          setSelectedRoomName(r.name);
                          onSendMessage(r.name);
                        }
                      }}
                      className={[
                        "flex flex-col gap-2.5 p-4 rounded-xl border transition-all duration-200 text-left select-none relative",
                        msg.id === lastBotMessageId ? "cursor-pointer" : "opacity-80 cursor-default",
                        isSelected
                          ? "border-blue-500 bg-blue-50/50 shadow-[0_4px_12px_rgba(59,130,246,0.12)]"
                          : "border-slate-200 bg-white hover:border-blue-400 hover:shadow-sm"
                      ].join(' ')}
                    >
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-lg text-blue-950 leading-snug">{r.name}</h4>
                        {isSelected && (
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-100/80 px-1.5 py-0.5 rounded">
                            ✓ Selected
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 space-y-1 font-semibold">
                        <div>👥 Capacity: <span className='text-violet-900 font-bold'>{r.capacity}</span> people</div>
                        <div>📍 Location: <span className='text-violet-900 font-bold'>{r.location || 'Main Floor'}</span></div>
                        <div>🖥 TV/Display: <span className='text-violet-900 font-bold'>{r.hasTv ? 'Available' : 'Not Available'}</span></div>
                      </div>

                      {msg.id === lastBotMessageId && (
                        <button
                          type="button"
                          className={[
                            "w-full text-center py-1.5 rounded-lg font-semibold text-xs transition-colors duration-150 mt-1 cursor-pointer",
                            isSelected
                              ? "bg-blue-600 text-white border border-blue-600"
                              : "bg-white text-blue-600 border border-blue-200 hover:border-blue-500 hover:bg-blue-50"
                          ].join(' ')}
                        >
                          {isSelected ? '✓ Selected' : 'Select Room'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </React.Fragment>
        ))}

        {showConfirmationCard && (
          <div className="flex justify-start w-full pl-10.5 my-2">
            <ConfirmationCard
              bookingData={session.bookingData}
              onConfirm={onConfirmBooking}
              onCancel={onCancelBooking}
            />
          </div>
        )}

        {showConflictCard && (
          <div className="flex justify-start w-full pl-10.5 my-2">
            <ConflictResolutionCard
              bookingData={session.bookingData}
              onSendMessage={onSendMessage}
              onCancel={onCancelBooking}
            />
          </div>
        )}

        {/* loading state while searching rooms */}
        {isTyping && (
          session?.step === 'AWAITING_ROOM_SELECTION' ? (
            <div className="flex items-center gap-2 py-1 my-2 pl-10.5 text-xs text-slate-500 animate-pulse font-medium">
              <span>🔍</span> Searching for eligible and available rooms...
            </div>
          ) : (
            <MessageBubble message={{ id: 'typing', sender: 'bot', text: '', isTyping: true }} />
          )
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Suggestions List */}
      {showSuggestions && (
        <div className="absolute left-5 bottom-17.5 w-[calc(100%-40px)] max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-[0_10px_25px_rgba(0,0,0,0.15)] z-30 divide-y divide-slate-100 animate-fade-in">
          <div className="sticky top-0 flex items-center justify-between bg-slate-50 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <span>People</span><span>{employeeSearchLoading ? 'Searching…' : `${suggestions.length} result${suggestions.length === 1 ? '' : 's'}`}</span>
          </div>
          {suggestions.map((emp, idx) => (
            <div
              key={emp.email}
              onClick={() => selectSuggestion(emp)}
              className={[
                "flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors duration-150",
                idx === activeSuggestionIndex ? "bg-blue-50 text-blue-900" : "hover:bg-slate-50 text-slate-700"
              ].join(' ')}
            >
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                {(emp.name || emp.email || '?').split(/\s+/).slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('')}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold">{emp.name}</span>
                <span className="text-[10px] text-slate-500">{emp.email}</span>
                {emp.department && <span className="text-[10px] text-slate-400">{emp.department}</span>}
              </div>
            </div>
          ))}
          {!employeeSearchLoading && !suggestions.length && !employeeSearchError && <div className="px-4 py-5 text-center text-xs text-slate-500">No people found. Try a name or email address.</div>}
          {employeeSearchError && <div className="px-4 py-4 text-xs text-red-700">{employeeSearchError}</div>}
        </div>
      )}

      {/* Quick Suggestions */}
      {!disableInput && !isAwaitingDate && (
        <div className="flex justify-between flex-wrap gap-2 px-5 py-2 border border-slate-200/70 rounded-[30px] mx-3 mb-2 shrink-0">
          {QUICK_SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSuggestionClick(s)}
              className="px-3.5 py-2 rounded-2xl border border-slate-200 bg-slate-100 text-slate-500 text-xs cursor-pointer transition-all duration-200 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 shrink-0"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {isAwaitingDate && (
        <form
          onSubmit={event => {
            event.preventDefault();
            if (selectedDate) onSendMessage(selectedDate);
          }}
          className="mx-4 mb-3 flex flex-wrap items-end gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4"
        >
          <label className="min-w-56 flex-1">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-violet-800">📅 Select booking date</span>
            <input
              type="date"
              required
              min={minimumDate}
              max={maximumDate}
              value={selectedDate}
              onChange={event => setSelectedDate(event.target.value)}
              className="w-full rounded-lg border border-violet-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
            />
            <span className="mt-1 block text-xs text-slate-500">Choose between {minimumDate} and {maximumDate}.</span>
          </label>
          <button
            type="submit"
            disabled={!selectedDate || isTyping}
            className="rounded-lg bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue
          </button>
        </form>
      )}

      {/* Input Form */}
      {!isAwaitingDate && <form
        onSubmit={handleSubmit}
        className="flex gap-2.5 items-center px-5 py-4 border-t border-slate-200 bg-white shrink-0"
      >
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={
            showRoomCardsStep
              ? "Select an available room above..."
              : disableInput
                ? "Please action the card above..."
                : "Type message... (use @ to invite teammates)"
          }
          disabled={showConfirmationCard || showConflictCard}
          className={[
            "flex-1 min-w-0 px-4 py-3 rounded-lg border border-slate-200 text-slate-900 text-sm outline-none transition-all duration-200",
            "focus:border-blue-400 focus:ring-2 focus:ring-blue-100",
            (showConfirmationCard || showConflictCard)
              ? "bg-slate-200 cursor-not-allowed"
              : "bg-white cursor-text"
          ].join(' ')}
        />
        <button
          type="submit"
          disabled={(showConfirmationCard || showConflictCard) || !inputValue.trim()}
          className={[
            "min-w-[84px] px-5 py-3 rounded-lg border-0 bg-blue-600 text-white font-semibold text-sm",
            "shadow-[0_4px_10px_rgba(37,99,235,0.15)] transition-all duration-200",
            (showConfirmationCard || showConflictCard) || !inputValue.trim()
              ? "opacity-50 cursor-not-allowed"
              : "hover:bg-blue-700 hover:-translate-y-0.5 cursor-pointer"
          ].join(' ')}
        >
          Send
        </button>
      </form>}
    </div>
  );
};

export default ChatWindow;
