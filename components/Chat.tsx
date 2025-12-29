import React, { useState, useEffect, useRef } from 'react';
import { UserSettings, ChatMessage, ChatRequest, PrivateChat, ChatGroup, DirectoryUser } from '../types';
import { db } from '../services/db';
import { Send, Users, UserPlus, Check, X, Reply, User, ArrowLeft, MoreHorizontal, MessageSquare, CheckCheck, Smile, Circle, ChevronRight } from 'lucide-react';

interface ChatProps {
  user: UserSettings;
}

// Curated School Emojis
const SCHOOL_EMOJIS = [
    '📚', '✏️', '🧠', '✅', '❌', '💯', '🎒', '🏫', '🔬', '🎨', 
    '📐', '💻', '📝', '📎', '💡', '⏰', '🏆', '🥇', '🤔', '👋'
];

export default function Chat({ user }: ChatProps) {
  const [activeTab, setActiveTab] = useState<'chats' | 'requests'>('chats'); 
  const [showChatView, setShowChatView] = useState(false);

  // Data State
  const [globalMessages, setGlobalMessages] = useState<ChatMessage[]>([]);
  const [requests, setRequests] = useState<ChatRequest[]>([]);
  const [privateChats, setPrivateChats] = useState<PrivateChat[]>([]);
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
  
  // UI State
  const [inputText, setInputText] = useState('');
  const [threadParent, setThreadParent] = useState<ChatMessage | null>(null); // New: Thread State
  
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeChatType, setActiveChatType] = useState<'global' | 'private' | 'group' | null>(null);

  // Modals & Overlays
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isFindingUser, setIsFindingUser] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false); 
  const [showEmojiPicker, setShowEmojiPicker] = useState(false); 

  // Creation States
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null); // New ref for thread scroll
  const inputRef = useRef<HTMLInputElement>(null);

  // --- Load Data ---
  const loadData = async () => {
    try {
      const [gl, reqs, priv, grps, dir] = await Promise.all([
          db.getGlobalMessages(),
          db.getRequests(user.username),
          db.getPrivateChats(user.username),
          db.getGroups(user.username),
          db.getDirectory()
      ]);
      setGlobalMessages(gl);
      setRequests(reqs);
      setPrivateChats(priv);
      setGroups(grps);
      setDirectory(dir);
    } catch (e) {
      console.error("Failed to sync chat", e);
    } 
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(), 5000); 
    return () => clearInterval(interval);
  }, [user.username]);

  useEffect(() => {
    // Scroll handling for main chat
    if (showChatView && !threadParent && messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [globalMessages, privateChats, groups, activeChatId, showChatView, threadParent]);

  useEffect(() => {
    // Scroll handling for thread view
    if (threadParent && threadEndRef.current) {
        threadEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [threadParent, globalMessages, privateChats, groups]); // Re-scroll when messages update in thread

  // --- Helpers ---
  const getOnlineUsers = () => {
      const all = directory.filter(u => u.username !== user.username);
      const online = all.filter(u => u.username.length % 2 === 0); 
      return [user, ...online]; 
  };
  
  const getOfflineUsers = () => {
       const all = directory.filter(u => u.username !== user.username);
       return all.filter(u => u.username.length % 2 !== 0);
  };

  const getCurrentMessages = () => {
      if (activeChatType === 'global') return globalMessages;
      if (activeChatType === 'group') return groups.find(g => g.id === activeChatId)?.messages || [];
      if (activeChatType === 'private') return privateChats.find(c => c.id === activeChatId)?.messages || [];
      return [];
  };

  const getReplyCount = (msgId: string) => {
    return getCurrentMessages().filter(m => m.replyTo?.id === msgId).length;
  };

  // --- Actions ---

  const sendMessage = async (e?: React.FormEvent, forceReplyTo?: ChatMessage) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text) return;

    // Determine reply context: forceReplyTo (Thread Parent) takes precedence, then local replyTo state
    const parent = forceReplyTo || null; 

    const msg: ChatMessage = {
      id: Date.now().toString(),
      senderName: user.name,
      senderUsername: user.username,
      content: text,
      timestamp: Date.now(),
      replyTo: parent ? { id: parent.id, senderName: parent.senderName, content: parent.content } : undefined
    };

    // Optimistic Update
    if (activeChatType === 'global') {
        setGlobalMessages(prev => [...prev, msg]);
        await db.sendGlobalMessage(msg);
    } else if (activeChatType === 'group' && activeChatId) {
        setGroups(prev => prev.map(g => g.id === activeChatId ? {...g, messages: [...g.messages, msg]} : g));
        await db.sendGroupMessage(activeChatId, msg);
    } else if (activeChatType === 'private' && activeChatId) {
        setPrivateChats(prev => prev.map(c => c.id === activeChatId ? {...c, messages: [...c.messages, msg]} : c));
        await db.sendPrivateMessage(activeChatId, msg);
    }

    setInputText('');
    setShowEmojiPicker(false);
  };

  const sendFriendRequest = async (targetUsername: string) => {
    const req: ChatRequest = {
      id: Date.now().toString(),
      fromUsername: user.username,
      fromName: user.name,
      toUsername: targetUsername,
      status: 'pending',
      timestamp: Date.now()
    };
    setRequests(prev => [...prev, req]);
    await db.sendRequest(req);
    setIsFindingUser(false);
    alert("Request Sent!");
  };

  const handleRequest = async (reqId: string, action: 'accepted' | 'rejected') => {
    setRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: action } : r));
    const updated = await db.updateRequestStatus(reqId, action);
    if (updated && action === 'accepted') {
        await db.createPrivateChat([updated.fromUsername, updated.toUsername]);
        loadData();
    }
  };

  const createGroup = async () => {
      if(!newGroupName.trim() || selectedGroupMembers.length === 0) return;
      const newGroup: ChatGroup = {
          id: Date.now().toString(),
          name: newGroupName,
          adminUsername: user.username,
          members: [...selectedGroupMembers, user.username],
          messages: []
      };
      await db.createGroup(newGroup);
      setNewGroupName('');
      setSelectedGroupMembers([]);
      setIsCreatingGroup(false);
      loadData();
  };
  
  const enterChat = (id: string | null, type: 'global' | 'private' | 'group') => {
      setActiveChatId(id);
      setActiveChatType(type);
      setShowChatView(true);
      setShowParticipants(false);
      setThreadParent(null);
  };

  const backToList = () => {
      setShowChatView(false);
      setActiveChatId(null);
      setActiveChatType(null);
      setThreadParent(null);
  };

  const getFriendsList = () => {
      const friendUsernames = new Set<string>();
      privateChats.forEach(chat => {
          chat.participants.forEach(p => {
              if (p !== user.username) friendUsernames.add(p);
          });
      });
      return Array.from(friendUsernames);
  };

  const getActiveChatName = () => {
      if (activeChatType === 'global') return "Global Community";
      if (activeChatType === 'group') return groups.find(g => g.id === activeChatId)?.name || "Group";
      if (activeChatType === 'private') {
          const chat = privateChats.find(c => c.id === activeChatId);
          return chat ? `@${chat.participants.find(p => p !== user.username)}` : "Chat";
      }
      return "";
  };

  const handleHeaderClick = () => {
      if (activeChatType === 'global') {
          setShowParticipants(true);
      }
  };

  const addEmoji = (emoji: string) => {
      setInputText(prev => prev + emoji);
      inputRef.current?.focus();
  };

  // --- Sub-Components ---

  const MessageBubble = ({ msg, isThreadView = false, replyCount = 0 }: { msg: ChatMessage, isThreadView?: boolean, replyCount?: number }) => {
      const isMe = msg.senderUsername === user.username;
      
      return (
        <div className={`flex items-end gap-2 mb-4 group ${isMe ? 'justify-end' : 'justify-start'}`}>
            
            {/* Left Side Reply Button (for My messages) */}
            {isMe && !isThreadView && (
                 <button 
                    onClick={(e) => { e.stopPropagation(); setThreadParent(msg); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-gray-700"
                    title="Reply in Thread"
                 >
                     <Reply className="w-4 h-4" />
                 </button>
            )}

            <div 
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%] cursor-pointer`}
                onClick={() => !isThreadView && setThreadParent(msg)}
            >
                {/* Name Label */}
                {!isMe && (
                   <span className={`text-[10px] font-bold mb-1 ml-3 ${['text-orange-500', 'text-pink-500', 'text-indigo-500', 'text-emerald-500'][msg.senderName.length % 4]}`}>
                       {msg.senderName}
                   </span>
                )}

                {/* Bubble */}
                <div className={`relative px-5 py-3 shadow-sm text-[15px] leading-relaxed transition-all ${
                    isMe 
                    ? 'bg-indigo-600 text-white rounded-3xl rounded-br-sm' 
                    : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-3xl rounded-bl-sm border border-gray-100 dark:border-gray-700'
                }`}>
                    {/* Quoted Content (Only in Thread View) */}
                    {isThreadView && msg.replyTo && (
                        <div className={`mb-2 rounded-lg p-2 text-xs border-l-2 ${isMe ? 'bg-white/20 border-white/50 text-white/90' : 'bg-gray-100 dark:bg-gray-700 border-indigo-500 text-gray-600 dark:text-gray-300'}`}>
                            <span className="font-bold block mb-0.5">{msg.replyTo.senderName}</span>
                            <span className="truncate block opacity-80">{msg.replyTo.content}</span>
                        </div>
                    )}

                    <div className="break-words whitespace-pre-wrap">{msg.content}</div>
                    
                    <div className={`text-[9px] font-bold mt-1 text-right flex justify-end items-center gap-1 ${isMe ? 'text-indigo-200' : 'text-gray-400'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        {isMe && <CheckCheck className="w-3 h-3"/>}
                        {/* Thread Indicator in Main View */}
                         {!isThreadView && replyCount > 0 && (
                             <div className={`flex items-center gap-1 ml-2 ${isMe ? 'text-blue-200' : 'text-blue-500'} font-bold`}>
                                 <span className="text-[10px]">{replyCount} replies</span>
                                 <ChevronRight className="w-3 h-3" />
                             </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Side Reply Button (for Others messages) */}
            {!isMe && !isThreadView && (
                 <button 
                    onClick={(e) => { e.stopPropagation(); setThreadParent(msg); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-gray-700"
                    title="Reply in Thread"
                 >
                     <Reply className="w-4 h-4" />
                 </button>
            )}
        </div>
      );
  };

  // 1. CHAT LIST VIEW (Navigation)
  if (!showChatView) {
      return (
          <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950 relative overflow-hidden">
              {/* Modern Header */}
              <div className="bg-white dark:bg-gray-900 px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center sticky top-0 z-30 shrink-0">
                  <div>
                    <h2 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">Chats</h2>
                    <p className="text-gray-500 text-xs font-semibold">Connect with friends</p>
                  </div>
                  <div className="flex gap-3">
                      <button onClick={() => setIsFindingUser(true)} className="p-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 transition-all text-gray-600 dark:text-gray-300"><UserPlus className="w-5 h-5"/></button>
                      <button onClick={() => setIsCreatingGroup(true)} className="p-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 transition-all text-gray-600 dark:text-gray-300"><Users className="w-5 h-5"/></button>
                  </div>
              </div>
              
              {/* Tabs */}
              <div className="mx-4 mt-4 bg-gray-200 dark:bg-gray-800 p-1.5 rounded-2xl flex shrink-0">
                  <button onClick={() => setActiveTab('chats')} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'chats' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>Messages</button>
                  <button onClick={() => setActiveTab('requests')} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all relative ${activeTab === 'requests' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                      Requests
                      {requests.filter(r => r.toUsername === user.username && r.status === 'pending').length > 0 && <span className="absolute top-2 right-4 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
                  </button>
              </div>

              {/* Chat List Body */}
              <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pt-4 pb-28">
                  {activeTab === 'chats' ? (
                      <div className="space-y-3">
                          <div onClick={() => enterChat(null, 'global')} className="group flex items-center gap-4 p-4 bg-white dark:bg-gray-900 hover:bg-indigo-50 dark:hover:bg-gray-800 cursor-pointer rounded-3xl transition-all border border-gray-100 dark:border-gray-800 hover:border-indigo-100 dark:hover:border-gray-700 shadow-sm">
                              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-200 dark:shadow-none group-hover:scale-105 transition-transform">
                                  <Users className="w-6 h-6"/>
                              </div>
                              <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-baseline mb-1">
                                      <h3 className="font-bold text-gray-900 dark:text-white text-base">Global Community</h3>
                                      <span className="text-[10px] text-gray-400 font-bold">{globalMessages.length > 0 ? new Date(globalMessages[globalMessages.length-1].timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span>
                                  </div>
                                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate font-medium">{globalMessages.length > 0 ? (globalMessages[globalMessages.length-1].senderUsername === user.username ? 'You: ' : '') + globalMessages[globalMessages.length-1].content : "Join the conversation"}</p>
                              </div>
                          </div>
                          {groups.map(g => (
                              <div key={g.id} onClick={() => enterChat(g.id, 'group')} className="group flex items-center gap-4 p-4 bg-white dark:bg-gray-900 hover:bg-emerald-50 dark:hover:bg-gray-800 cursor-pointer rounded-3xl transition-all border border-gray-100 dark:border-gray-800 hover:border-emerald-100 dark:hover:border-gray-700 shadow-sm">
                                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-200 dark:shadow-none group-hover:scale-105 transition-transform">
                                      <Users className="w-6 h-6"/>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                      <div className="flex justify-between items-baseline mb-1">
                                          <h3 className="font-bold text-gray-900 dark:text-white text-base">{g.name}</h3>
                                          <span className="text-[10px] text-gray-400 font-bold">{g.messages.length > 0 ? new Date(g.messages[g.messages.length-1].timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span>
                                      </div>
                                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate font-medium">{g.messages.length > 0 ? (g.messages[g.messages.length-1].senderUsername === user.username ? 'You: ' : '') + g.messages[g.messages.length-1].content : "No messages"}</p>
                                  </div>
                              </div>
                          ))}
                          {privateChats.map(c => {
                              const other = c.participants.find(p => p !== user.username);
                              const lastMsg = c.messages[c.messages.length-1];
                              return (
                                  <div key={c.id} onClick={() => enterChat(c.id, 'private')} className="group flex items-center gap-4 p-4 bg-white dark:bg-gray-900 hover:bg-indigo-50 dark:hover:bg-gray-800 cursor-pointer rounded-3xl transition-all border border-gray-100 dark:border-gray-800 hover:border-indigo-100 dark:hover:border-gray-700 shadow-sm">
                                      <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-300 group-hover:bg-indigo-200 dark:group-hover:bg-gray-600 group-hover:text-indigo-700 dark:group-hover:text-white transition-colors">
                                          <User className="w-6 h-6"/>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                          <div className="flex justify-between items-baseline mb-1">
                                              <h3 className="font-bold text-gray-900 dark:text-white text-base">@{other}</h3>
                                              <span className="text-[10px] text-gray-400 font-bold">{lastMsg ? new Date(lastMsg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span>
                                          </div>
                                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate font-medium">{lastMsg ? (lastMsg.senderUsername === user.username ? 'You: ' : '') + lastMsg.content : "Start chatting"}</p>
                                      </div>
                                  </div>
                              )
                          })}
                      </div>
                  ) : (
                      <div className="space-y-4">
                          <div className="bg-orange-50 dark:bg-orange-900/10 p-6 rounded-[2rem] border border-orange-100 dark:border-orange-900/20">
                              <h4 className="font-bold text-orange-800 dark:text-orange-300 mb-4 flex items-center gap-2"><UserPlus className="w-4 h-4"/> Friend Requests</h4>
                              {requests.filter(r => r.toUsername === user.username && r.status === 'pending').length === 0 ? (
                                  <div className="text-center py-8">
                                    <p className="text-sm text-orange-600/70 dark:text-orange-400/50 font-medium">No pending requests.</p>
                                  </div>
                              ) : (
                                  requests.filter(r => r.toUsername === user.username && r.status === 'pending').map(r => (
                                      <div key={r.id} className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-2xl mt-3 shadow-sm border border-orange-100 dark:border-gray-700">
                                          <div>
                                              <p className="font-bold dark:text-white text-base">@{r.fromUsername}</p>
                                              <p className="text-xs text-gray-400">{r.fromName}</p>
                                          </div>
                                          <div className="flex gap-2">
                                              <button onClick={() => handleRequest(r.id, 'rejected')} className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 rounded-xl hover:bg-red-100 transition-colors"><X className="w-4 h-4"/></button>
                                              <button onClick={() => handleRequest(r.id, 'accepted')} className="p-3 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-300 rounded-xl hover:bg-green-100 transition-colors"><Check className="w-4 h-4"/></button>
                                          </div>
                                      </div>
                                  ))
                              )}
                          </div>
                      </div>
                  )}
              </div>
              
              {/* Modals for Create Group / Find User (Same as before) */}
              {isFindingUser && (
                  <div className="absolute inset-0 bg-white dark:bg-gray-900 z-50 p-6 animate-fade-in flex flex-col">
                      <div className="flex items-center gap-4 mb-6">
                          <button onClick={() => setIsFindingUser(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"><ArrowLeft className="w-6 h-6 dark:text-white"/></button>
                          <h2 className="text-2xl font-black dark:text-white">Find People</h2>
                      </div>
                      <input 
                         className="w-full bg-gray-100 dark:bg-gray-800 p-4 rounded-2xl mb-6 outline-none dark:text-white font-bold placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 transition-all"
                         placeholder="Search username..."
                         value={searchTerm}
                         onChange={e => setSearchTerm(e.target.value)}
                         autoFocus
                      />
                      <div className="flex-1 overflow-y-auto">
                          {directory.filter(u => u.username !== user.username && u.username.includes(searchTerm.toLowerCase())).map(u => (
                              <div key={u.username} className="flex justify-between items-center p-4 border-b border-gray-50 dark:border-gray-800">
                                  <div>
                                      <p className="font-bold text-lg dark:text-white">{u.name}</p>
                                      <p className="text-sm text-gray-500 font-medium">@{u.username}</p>
                                  </div>
                                  <button onClick={() => sendFriendRequest(u.username)} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 active:scale-95 transition-all">Add</button>
                              </div>
                          ))}
                      </div>
                  </div>
              )}
              {isCreatingGroup && (
                  <div className="absolute inset-0 bg-white dark:bg-gray-900 z-50 p-6 animate-fade-in flex flex-col">
                      <div className="flex items-center gap-4 mb-6">
                          <button onClick={() => setIsCreatingGroup(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"><ArrowLeft className="w-6 h-6 dark:text-white"/></button>
                          <h2 className="text-2xl font-black dark:text-white">New Group</h2>
                      </div>
                      <input 
                         className="w-full bg-gray-100 dark:bg-gray-800 p-4 rounded-2xl mb-6 outline-none dark:text-white font-bold placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 transition-all"
                         placeholder="Group Name"
                         value={newGroupName}
                         onChange={e => setNewGroupName(e.target.value)}
                      />
                      <p className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-wider">Select Friends</p>
                      <div className="flex-1 overflow-y-auto mb-6 space-y-2">
                          {getFriendsList().map(f => (
                              <div key={f} className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all ${selectedGroupMembers.includes(f) ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200' : 'bg-gray-50 dark:bg-gray-800 border-transparent'}`} onClick={() => {
                                  setSelectedGroupMembers(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
                              }}>
                                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selectedGroupMembers.includes(f) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                                      {selectedGroupMembers.includes(f) && <Check className="w-4 h-4 text-white"/>}
                                  </div>
                                  <span className="font-bold dark:text-white text-lg">@{f}</span>
                              </div>
                          ))}
                      </div>
                      <button onClick={createGroup} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-indigo-200 dark:shadow-none hover:opacity-90 active:scale-95 transition-all">Create Group</button>
                  </div>
              )}
          </div>
      );
  }

  // 2. ACTIVE CHAT VIEW (Thread or Main)
  
  // -- THREAD VIEW OVERLAY --
  if (threadParent) {
     const threadMessages = getCurrentMessages().filter(m => m.replyTo?.id === threadParent.id);
     
     return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950 relative z-30 overflow-hidden animate-fade-in">
            {/* Thread Header */}
            <div className="px-4 py-3 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl flex items-center gap-4 shadow-sm sticky top-0 z-20 border-b border-gray-100 dark:border-gray-800">
                <button onClick={() => setThreadParent(null)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-transform">
                    <ArrowLeft className="w-6 h-6 text-gray-800 dark:text-white"/>
                </button>
                <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg leading-tight">Thread</h3>
                    <p className="text-xs text-gray-500 font-medium">Replying to {threadParent.senderName}</p>
                </div>
            </div>

            {/* Thread Content */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar relative">
                {/* Parent Message (Hero) */}
                <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-800 border-dashed">
                    <MessageBubble msg={threadParent} isThreadView={true} />
                </div>
                
                {/* Replies */}
                <div className="space-y-2 pb-4">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 text-center">
                        {threadMessages.length} Replies
                    </div>
                    {threadMessages.map(msg => (
                        <MessageBubble key={msg.id} msg={msg} isThreadView={true} />
                    ))}
                    <div ref={threadEndRef} />
                </div>
            </div>

            {/* Thread Input (Emoji Picker Enabled Here) */}
            <div className="p-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-t border-gray-100 dark:border-gray-800 relative">
                {showEmojiPicker && (
                    <div className="absolute bottom-full left-4 mb-2 bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 grid grid-cols-5 gap-1 animate-fade-in-up z-50 w-full max-w-xs">
                        {SCHOOL_EMOJIS.map(emo => (
                            <button key={emo} onClick={() => addEmoji(emo)} className="text-xl p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                                {emo}
                            </button>
                        ))}
                    </div>
                )}
                
                <div className="flex gap-2 items-end bg-gray-100 dark:bg-gray-800 p-1.5 rounded-[2rem] shadow-sm border border-transparent focus-within:border-indigo-500/30 transition-all">
                     <button 
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className={`p-3 rounded-full transition-colors ${showEmojiPicker ? 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20' : 'text-gray-400 hover:text-indigo-500'}`}
                    >
                        <Smile className="w-6 h-6"/>
                    </button>
                    <input 
                        ref={inputRef}
                        className="flex-1 bg-transparent outline-none text-base dark:text-white py-3 max-h-32 placeholder-gray-400 font-medium" 
                        placeholder={`Reply to ${threadParent.senderName}...`}
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && sendMessage(e, threadParent)}
                    />
                    <button 
                        onClick={(e) => sendMessage(e, threadParent)}
                        className={`w-11 h-11 rounded-full flex items-center justify-center text-white shadow-md active:scale-95 transition-all ${!inputText.trim() ? 'bg-gray-300 dark:bg-gray-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                        disabled={!inputText.trim()}
                    >
                        <Send className="w-5 h-5 ml-0.5"/>
                    </button>
                </div>
            </div>
        </div>
     );
  }

  // -- MAIN CHAT VIEW --
  return (
      <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950 relative z-20 overflow-hidden">
          
          {/* Participants Modal (Global Chat Only) */}
          {showParticipants && activeChatType === 'global' && (
              <div className="absolute inset-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md p-4 animate-fade-in flex flex-col">
                   <div className="flex items-center justify-between mb-6">
                       <h2 className="text-2xl font-black dark:text-white">Community Members</h2>
                       <button onClick={() => setShowParticipants(false)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full"><X className="w-6 h-6 dark:text-white"/></button>
                   </div>
                   
                   <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
                       <div>
                           <h3 className="text-xs font-bold text-green-600 mb-3 uppercase tracking-wider flex items-center gap-2">
                               <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                               Online ({getOnlineUsers().length})
                           </h3>
                           <div className="space-y-2">
                               {getOnlineUsers().map((u, i) => (
                                   <div key={i} className="flex items-center gap-3 p-3 bg-green-50/50 dark:bg-green-900/10 rounded-xl border border-green-100 dark:border-green-900/20">
                                       <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 text-white flex items-center justify-center text-xs font-bold">
                                           {u.name.charAt(0)}
                                       </div>
                                       <span className="font-bold text-gray-800 dark:text-gray-200">{u.name} <span className="text-gray-400 text-xs font-normal">(@{u.username})</span></span>
                                   </div>
                               ))}
                           </div>
                       </div>
                       <div>
                           <h3 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                               <Circle className="w-2 h-2 fill-gray-300 text-gray-300"/>
                               Offline ({getOfflineUsers().length})
                           </h3>
                           <div className="space-y-2">
                               {getOfflineUsers().map((u, i) => (
                                   <div key={i} className="flex items-center gap-3 p-3 opacity-60">
                                       <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 flex items-center justify-center text-xs font-bold">
                                           {u.name.charAt(0)}
                                       </div>
                                       <span className="font-bold text-gray-800 dark:text-gray-200">{u.name} <span className="text-gray-400 text-xs font-normal">(@{u.username})</span></span>
                                   </div>
                               ))}
                           </div>
                       </div>
                   </div>
              </div>
          )}

          {/* Modern Glass Header */}
          <div className="px-4 py-3 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl flex items-center justify-between shadow-sm sticky top-0 z-20 border-b border-gray-100 dark:border-gray-800 shrink-0">
              <div className="flex items-center gap-2">
                <button onClick={backToList} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-transform">
                    <ArrowLeft className="w-6 h-6 text-gray-800 dark:text-white"/>
                </button>
                
                <div 
                    className={`flex items-center gap-3 ${activeChatType === 'global' ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                    onClick={handleHeaderClick}
                >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md bg-gradient-to-br ${activeChatType === 'global' ? 'from-indigo-500 to-purple-600' : activeChatType === 'group' ? 'from-emerald-400 to-teal-600' : 'from-gray-400 to-gray-500'}`}>
                        {activeChatType === 'global' ? <Users className="w-5 h-5"/> : activeChatType === 'group' ? <Users className="w-5 h-5"/> : <User className="w-5 h-5"/>}
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 dark:text-white text-base leading-tight">{getActiveChatName()}</h3>
                        <p className="text-[10px] font-bold text-green-500 leading-tight">
                            {activeChatType === 'global' 
                              ? `${getOnlineUsers().length} Online, ${directory.length} Total` 
                              : "Active now"}
                        </p>
                    </div>
                </div>
              </div>
              <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"><MoreHorizontal className="w-5 h-5 text-gray-500"/></button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar relative">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cross-stripes.png')] opacity-[0.04] dark:opacity-[0.05] pointer-events-none fixed"></div>
              
              <div className="space-y-2 pb-40">
                  {getCurrentMessages()
                    .filter(msg => !msg.replyTo) // Filter out replies from main view
                    .map((msg) => {
                        const count = getReplyCount(msg.id);
                        return <MessageBubble key={msg.id} msg={msg} replyCount={count} />;
                    })
                  }
                  <div ref={messagesEndRef} />
              </div>
          </div>

          {/* Main Input - Raised to Avoid Nav Bar */}
          <div className="absolute bottom-24 left-4 right-4 z-30">
              <div className="max-w-3xl mx-auto relative">
                <div className="flex gap-2 items-end bg-white/90 dark:bg-gray-900/90 backdrop-blur-md p-1.5 rounded-[2rem] shadow-2xl border border-gray-100 dark:border-gray-800">
                    <input 
                        ref={inputRef}
                        className="flex-1 bg-transparent outline-none text-base dark:text-white py-3 pl-5 max-h-32 placeholder-gray-400 font-medium" 
                        placeholder="Type a message..."
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && sendMessage(e)}
                    />
                    <button 
                        onClick={(e) => sendMessage(e)}
                        className={`w-11 h-11 rounded-full flex items-center justify-center text-white shadow-md active:scale-95 transition-all ${!inputText.trim() ? 'bg-gray-300 dark:bg-gray-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                        disabled={!inputText.trim()}
                    >
                        <Send className="w-5 h-5 ml-0.5"/>
                    </button>
                </div>
              </div>
          </div>
      </div>
  );
}