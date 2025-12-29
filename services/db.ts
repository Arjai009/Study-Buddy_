import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from '../constants';
import { UserSettings, ChatMessage, ChatRequest, PrivateChat, ChatGroup, DirectoryUser, ClassLevel } from '../types';

// Detect if we are in "Offline/Mock" mode
// We check if the keys are placeholders, empty, OR if they match the default demo project which might be paused/broken.
const DEFAULT_DEMO_URL = "isyotjzilabszeytdhbh"; 

const isMockMode = !SUPABASE_URL || 
                   !SUPABASE_KEY || 
                   SUPABASE_URL.includes("placeholder") || 
                   SUPABASE_KEY.includes("placeholder") ||
                   SUPABASE_URL.includes(DEFAULT_DEMO_URL); // Force local storage if using the default shared key

if (isMockMode) {
  console.log("[DB] ⚠️ Using Local Storage Mode (Offline/Demo). Chat will be saved locally.");
}

// Initialize Supabase only if keys look valid-ish to avoid immediate throw
const safeUrl = isMockMode ? "https://placeholder.supabase.co" : SUPABASE_URL;
const safeKey = isMockMode ? "placeholder" : SUPABASE_KEY;
export const supabase = createClient(safeUrl, safeKey);

// --- LOCAL STORAGE HELPERS (MOCK DB) ---
const STORAGE_PREFIX = 'study_buddy_mock_';
const getItem = <T>(key: string, defaultVal: T): T => {
  try {
    const item = localStorage.getItem(STORAGE_PREFIX + key);
    return item ? JSON.parse(item) : defaultVal;
  } catch { return defaultVal; }
};
const setItem = (key: string, val: any) => {
  localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(val));
};

export const db = {
  // --- Auth & Session ---
  async getSession(): Promise<UserSettings | null> {
    const username = localStorage.getItem('study_buddy_username');
    if (!username) return null;
    
    // MOCK MODE
    if (isMockMode) {
      const profiles = getItem<any[]>('profiles', []);
      const user = profiles.find(p => p.username === username);
      if (user) {
         return {
          name: user.name,
          username: user.username,
          email: user.email,
          classLevel: user.classLevel || '10',
          isAuthenticated: true,
          quizHistory: user.quizHistory || [],
          bookmarks: user.bookmarks || [],
          darkMode: false
         }
      }
      return null;
    }

    try {
        const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single();

        if (error || !data) return null;

        return {
          name: data.name,
          username: data.username,
          email: data.email,
          classLevel: data.class_level,
          isAuthenticated: true,
          quizHistory: data.quiz_history || [],
          bookmarks: data.bookmarks || [],
          darkMode: false
        };
    } catch (e) {
        console.error("Session load error:", e);
        return null;
    }
  },

  async login(name: string, email: string, username: string, classLevel: ClassLevel, password?: string): Promise<UserSettings> {
    const cleanUsername = username.toLowerCase().trim();
    localStorage.setItem('study_buddy_username', cleanUsername);

    // MOCK MODE
    if (isMockMode) {
       const profiles = getItem<any[]>('profiles', []);
       let user = profiles.find(p => p.username === cleanUsername);
       
       if (user) {
         // Update existing
         user.name = name;
         user.classLevel = classLevel;
         const newProfiles = profiles.map(p => p.username === cleanUsername ? user : p);
         setItem('profiles', newProfiles);
       } else {
         // Create new
         user = {
           username: cleanUsername,
           name,
           email,
           classLevel,
           quizHistory: [],
           bookmarks: []
         };
         profiles.push(user);
         setItem('profiles', profiles);
       }
       
       return { ...user, isAuthenticated: true, darkMode: false };
    }

    // REAL DB MODE
    const { data: userByUsername } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', cleanUsername)
        .single();

    if (userByUsername && userByUsername.email.toLowerCase() !== email.toLowerCase()) {
        throw new Error(`Username '${cleanUsername}' is already taken.`);
    }

    if (password) {
        try {
            await supabase.auth.signUp({ email, password, options: { data: { username: cleanUsername, name } }});
            await supabase.auth.signInWithPassword({ email, password });
        } catch (e) { /* ignore */ }
    }

    let userProfile;

    if (userByUsername) {
        const { data, error } = await supabase
            .from('profiles')
            .update({ name, class_level: classLevel })
            .eq('username', cleanUsername)
            .select().single();
        if (error) throw error;
        userProfile = data;
    } else {
        const { data, error } = await supabase
            .from('profiles')
            .insert([{ username: cleanUsername, name, email: email.toLowerCase(), class_level: classLevel, quiz_history: [], bookmarks: [] }])
            .select().single();
        if (error) throw error;
        userProfile = data;
    }

    return {
        name: userProfile.name,
        username: userProfile.username,
        email: userProfile.email,
        classLevel: userProfile.class_level,
        isAuthenticated: true,
        quizHistory: userProfile.quiz_history || [],
        bookmarks: userProfile.bookmarks || [],
        darkMode: false
    };
  },

  async updateProfile(settings: UserSettings): Promise<void> {
    if (isMockMode) {
        const profiles = getItem<any[]>('profiles', []);
        const idx = profiles.findIndex(p => p.username === settings.username);
        if (idx !== -1) {
            profiles[idx] = {
                ...profiles[idx],
                name: settings.name,
                classLevel: settings.classLevel,
                quizHistory: settings.quizHistory,
                bookmarks: settings.bookmarks
            };
            setItem('profiles', profiles);
        }
        return;
    }

    await supabase.from('profiles').update({
        name: settings.name,
        class_level: settings.classLevel,
        quiz_history: settings.quizHistory,
        bookmarks: settings.bookmarks
    }).eq('username', settings.username);
  },

  async logout(): Promise<void> {
    if (!isMockMode) await supabase.auth.signOut();
    localStorage.removeItem('study_buddy_username');
  },

  async getDirectory(): Promise<DirectoryUser[]> {
    if (isMockMode) {
        return getItem<any[]>('profiles', []).map(p => ({
            name: p.name,
            username: p.username,
            classLevel: p.classLevel
        }));
    }
    const { data } = await supabase.from('profiles').select('name, username, class_level');
    return (data || []).map((u: any) => ({ name: u.name, username: u.username, classLevel: u.class_level }));
  },

  // --- Global Chat ---
  async getGlobalMessages(): Promise<ChatMessage[]> {
    if (isMockMode) {
        return getItem<ChatMessage[]>('global_messages', []);
    }
    const { data } = await supabase.from('global_messages').select('*').order('timestamp', { ascending: true }).limit(100);
    return (data || []).map((msg: any) => ({
        id: msg.id,
        senderName: msg.sender_name,
        senderUsername: msg.sender_username,
        content: msg.content,
        timestamp: msg.timestamp,
        replyTo: msg.reply_to
    }));
  },

  async sendGlobalMessage(msg: ChatMessage): Promise<string | null> {
    if (isMockMode) {
        const msgs = getItem<ChatMessage[]>('global_messages', []);
        msgs.push(msg);
        if(msgs.length > 100) msgs.shift();
        setItem('global_messages', msgs);
        return msg.id;
    }
    const { data, error } = await supabase.from('global_messages').insert([{
      id: msg.id,
      content: msg.content,
      sender_name: msg.senderName,
      sender_username: msg.senderUsername,
      timestamp: msg.timestamp,
      reply_to: msg.replyTo
    }]).select().single();
    if (error) return null;
    return data?.id || null;
  },

  // --- Private Chat ---
  async getPrivateChats(username: string): Promise<PrivateChat[]> {
    if (isMockMode) {
        const chats = getItem<PrivateChat[]>('private_chats', []);
        return chats.filter(c => c.participants.includes(username));
    }
    const { data } = await supabase.from('private_chats').select('*');
    return (data || [])
        .filter((c: any) => Array.isArray(c.participants) && c.participants.includes(username))
        .map((c: any) => ({ id: c.id, participants: c.participants, messages: c.messages || [] }));
  },

  async sendPrivateMessage(chatId: string, msg: ChatMessage): Promise<void> {
    if (isMockMode) {
        const chats = getItem<PrivateChat[]>('private_chats', []);
        const idx = chats.findIndex(c => c.id === chatId);
        if (idx !== -1) {
            chats[idx].messages.push(msg);
            setItem('private_chats', chats);
        }
        return;
    }
    const { data } = await supabase.from('private_chats').select('messages').eq('id', chatId).single();
    const newMessages = [...(data?.messages || []), msg];
    await supabase.from('private_chats').update({ messages: newMessages }).eq('id', chatId);
  },

  async createPrivateChat(participants: string[]): Promise<void> {
    const sorted = participants.map(p => p.toLowerCase().trim()).sort();
    if (isMockMode) {
        const chats = getItem<PrivateChat[]>('private_chats', []);
        const exists = chats.find(c => JSON.stringify(c.participants.sort()) === JSON.stringify(sorted));
        if (!exists) {
            chats.push({ id: Date.now().toString(), participants: sorted, messages: [] });
            setItem('private_chats', chats);
        }
        return;
    }
    
    const { data: allChats } = await supabase.from('private_chats').select('*');
    const existing = (allChats || []).find((c: any) => {
        const cParticipants = (c.participants || []).map((p: string) => p.toLowerCase().trim()).sort();
        return JSON.stringify(cParticipants) === JSON.stringify(sorted);
    });

    if (!existing) {
        await supabase.from('private_chats').insert([{ id: Date.now().toString(), participants: sorted, messages: [] }]);
    }
  },

  // --- Requests ---
  async getRequests(username: string): Promise<ChatRequest[]> {
    if (isMockMode) {
        const reqs = getItem<ChatRequest[]>('requests', []);
        return reqs.filter(r => r.toUsername === username || r.fromUsername === username);
    }
    const { data } = await supabase.from('chat_requests').select('*').or(`to_username.eq.${username},from_username.eq.${username}`);
    return (data || []).map((r: any) => ({
        id: r.id, fromUsername: r.from_username, fromName: r.from_name, toUsername: r.to_username, status: r.status, timestamp: r.timestamp
    }));
  },

  async sendRequest(req: ChatRequest): Promise<void> {
    if (isMockMode) {
        const reqs = getItem<ChatRequest[]>('requests', []);
        // Check duplicate
        if(!reqs.find(r => r.fromUsername === req.fromUsername && r.toUsername === req.toUsername && r.status === 'pending')) {
            reqs.push(req);
            setItem('requests', reqs);
        }
        return;
    }
    const { data } = await supabase.from('chat_requests').select('*')
        .eq('from_username', req.fromUsername).eq('to_username', req.toUsername).eq('status', 'pending');
    if (!data || data.length === 0) {
        await supabase.from('chat_requests').insert([{
            id: req.id, from_username: req.fromUsername, from_name: req.fromName, to_username: req.toUsername, status: 'pending', timestamp: req.timestamp
        }]);
    }
  },

  async updateRequestStatus(reqId: string, status: 'accepted' | 'rejected'): Promise<ChatRequest | null> {
    if (isMockMode) {
        const reqs = getItem<ChatRequest[]>('requests', []);
        const idx = reqs.findIndex(r => r.id === reqId);
        if (idx !== -1) {
            reqs[idx].status = status;
            setItem('requests', reqs);
            return reqs[idx];
        }
        return null;
    }
    const { data } = await supabase.from('chat_requests').update({ status }).eq('id', reqId).select().single();
    if (!data) return null;
    return { id: data.id, fromUsername: data.from_username, fromName: data.from_name, toUsername: data.to_username, status: data.status, timestamp: data.timestamp };
  },

  // --- Groups ---
  async getGroups(username: string): Promise<ChatGroup[]> {
    if (isMockMode) {
        const groups = getItem<ChatGroup[]>('groups', []);
        return groups.filter(g => g.members.includes(username));
    }
    const { data } = await supabase.from('chat_groups').select('*');
    return (data || []).filter((g: any) => Array.isArray(g.members) && g.members.includes(username)).map((g: any) => ({
        id: g.id, name: g.name, adminUsername: g.admin_username, members: g.members, messages: g.messages || []
    }));
  },

  async createGroup(group: ChatGroup): Promise<void> {
    if (isMockMode) {
        const groups = getItem<ChatGroup[]>('groups', []);
        groups.push(group);
        setItem('groups', groups);
        return;
    }
    await supabase.from('chat_groups').insert([{
      id: group.id, name: group.name, admin_username: group.adminUsername, members: group.members, messages: []
    }]);
  },

  async sendGroupMessage(groupId: string, msg: ChatMessage): Promise<void> {
    if (isMockMode) {
        const groups = getItem<ChatGroup[]>('groups', []);
        const idx = groups.findIndex(g => g.id === groupId);
        if (idx !== -1) {
            groups[idx].messages.push(msg);
            setItem('groups', groups);
        }
        return;
    }
    const { data } = await supabase.from('chat_groups').select('messages').eq('id', groupId).single();
    const newMessages = [...(data?.messages || []), msg];
    await supabase.from('chat_groups').update({ messages: newMessages }).eq('id', groupId);
  }
};