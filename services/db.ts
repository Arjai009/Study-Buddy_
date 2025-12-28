import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from '../constants';
import { UserSettings, ChatMessage, ChatRequest, PrivateChat, ChatGroup, DirectoryUser, ClassLevel } from '../types';

// Initialize Supabase Client safely
// If keys are missing, we use placeholders to prevent the app from crashing on load.
// API calls will simply fail with 401/404 if keys are invalid, which is better than a white screen crash.
const safeUrl = SUPABASE_URL || "https://placeholder.supabase.co";
const safeKey = SUPABASE_KEY || "placeholder";

export const supabase = createClient(safeUrl, safeKey);

export const db = {
  // --- Auth & Session ---
  async getSession(): Promise<UserSettings | null> {
    const username = localStorage.getItem('study_buddy_username');
    if (!username) return null;
    
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
    
    // 1. Check if user profile exists
    const { data: userByUsername } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', cleanUsername)
        .single();

    if (userByUsername && userByUsername.email.toLowerCase() !== email.toLowerCase()) {
        throw new Error(`Username '${cleanUsername}' is already taken.`);
    }

    // 2. Optional: Auth with Supabase (Best effort)
    if (password) {
        try {
            await supabase.auth.signUp({ 
                email, 
                password,
                options: { data: { username: cleanUsername, name } }
            });
            // Try to sign in immediately after signup
            await supabase.auth.signInWithPassword({ email, password });
        } catch (e) {
            console.warn("Supabase Auth skipped or failed (using Profile mode):", e);
        }
    }

    let userProfile;

    // 3. Update or Insert Profile
    if (userByUsername) {
        const { data, error } = await supabase
            .from('profiles')
            .update({ name, class_level: classLevel })
            .eq('username', cleanUsername)
            .select()
            .single();
        if (error) throw error;
        userProfile = data;
    } else {
        const { data, error } = await supabase
            .from('profiles')
            .insert([{
                username: cleanUsername,
                name,
                email: email.toLowerCase(),
                class_level: classLevel,
                quiz_history: [],
                bookmarks: []
            }])
            .select()
            .single();
        if (error) throw error;
        userProfile = data;
    }

    localStorage.setItem('study_buddy_username', cleanUsername);

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
    await supabase.from('profiles').update({
        name: settings.name,
        class_level: settings.classLevel,
        quiz_history: settings.quizHistory,
        bookmarks: settings.bookmarks
    }).eq('username', settings.username);
  },

  async logout(): Promise<void> {
    await supabase.auth.signOut();
    localStorage.removeItem('study_buddy_username');
  },

  async getDirectory(): Promise<DirectoryUser[]> {
    const { data } = await supabase.from('profiles').select('name, username, class_level');
    return (data || []).map((u: any) => ({ name: u.name, username: u.username, classLevel: u.class_level }));
  },

  // --- Global Chat ---
  async getGlobalMessages(): Promise<ChatMessage[]> {
    const { data } = await supabase
        .from('global_messages')
        .select('*')
        .order('timestamp', { ascending: true })
        .limit(100);
    
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
    const payload = {
      id: msg.id,
      content: msg.content,
      sender_name: msg.senderName,
      sender_username: msg.senderUsername,
      timestamp: msg.timestamp,
      reply_to: msg.replyTo
    };
    const { data, error } = await supabase.from('global_messages').insert([payload]).select().single();
    if (error) {
        console.error("Error sending global message", error);
        return null;
    }
    return data?.id || null;
  },

  // --- Private Chat ---
  async getPrivateChats(username: string): Promise<PrivateChat[]> {
    // Client-side filter for JSONB array to ensure robustness
    const { data } = await supabase.from('private_chats').select('*');
    
    return (data || [])
        .filter((c: any) => Array.isArray(c.participants) && c.participants.includes(username))
        .map((c: any) => ({
            id: c.id,
            participants: c.participants,
            messages: c.messages || []
        }));
  },

  async sendPrivateMessage(chatId: string, msg: ChatMessage): Promise<void> {
    const { data } = await supabase.from('private_chats').select('messages').eq('id', chatId).single();
    const currentMessages = data?.messages || [];
    const newMessages = [...currentMessages, msg];
    await supabase.from('private_chats').update({ messages: newMessages }).eq('id', chatId);
  },

  async createPrivateChat(participants: string[]): Promise<void> {
    const sortedParticipants = participants.map(p => p.toLowerCase().trim()).sort();
    
    // Fetch all to check existing (simplest logic for small apps)
    const { data: allChats } = await supabase.from('private_chats').select('*');
    const existing = (allChats || []).find((c: any) => {
        const cParticipants = (c.participants || []).map((p: string) => p.toLowerCase().trim()).sort();
        return JSON.stringify(cParticipants) === JSON.stringify(sortedParticipants);
    });

    if (!existing) {
        await supabase.from('private_chats').insert([{
            id: Date.now().toString(),
            participants: sortedParticipants,
            messages: []
        }]);
    }
  },

  // --- Requests ---
  async getRequests(username: string): Promise<ChatRequest[]> {
    const { data } = await supabase
        .from('chat_requests')
        .select('*')
        .or(`to_username.eq.${username},from_username.eq.${username}`);
        
    return (data || []).map((r: any) => ({
        id: r.id,
        fromUsername: r.from_username,
        fromName: r.from_name,
        toUsername: r.to_username,
        status: r.status,
        timestamp: r.timestamp
    }));
  },

  async sendRequest(req: ChatRequest): Promise<void> {
    const { data } = await supabase
        .from('chat_requests')
        .select('*')
        .eq('from_username', req.fromUsername)
        .eq('to_username', req.toUsername)
        .eq('status', 'pending');

    if (!data || data.length === 0) {
        await supabase.from('chat_requests').insert([{
            id: req.id,
            from_username: req.fromUsername,
            from_name: req.fromName,
            to_username: req.toUsername,
            status: 'pending',
            timestamp: req.timestamp
        }]);
    }
  },

  async updateRequestStatus(reqId: string, status: 'accepted' | 'rejected'): Promise<ChatRequest | null> {
    const { data, error } = await supabase
        .from('chat_requests')
        .update({ status })
        .eq('id', reqId)
        .select()
        .single();
        
    if (error || !data) return null;
    
    return {
        id: data.id,
        fromUsername: data.from_username,
        fromName: data.from_name,
        toUsername: data.to_username,
        status: data.status,
        timestamp: data.timestamp
    };
  },

  // --- Groups ---
  async getGroups(username: string): Promise<ChatGroup[]> {
    const { data } = await supabase.from('chat_groups').select('*');
    
    return (data || [])
        .filter((g: any) => Array.isArray(g.members) && g.members.includes(username))
        .map((g: any) => ({
            id: g.id,
            name: g.name,
            adminUsername: g.admin_username,
            members: g.members,
            messages: g.messages || []
        }));
  },

  async createGroup(group: ChatGroup): Promise<void> {
    await supabase.from('chat_groups').insert([{
      id: group.id,
      name: group.name,
      admin_username: group.adminUsername,
      members: group.members,
      messages: []
    }]);
  },

  async sendGroupMessage(groupId: string, msg: ChatMessage): Promise<void> {
    const { data } = await supabase.from('chat_groups').select('messages').eq('id', groupId).single();
    const currentMessages = data?.messages || [];
    const newMessages = [...currentMessages, msg];
    await supabase.from('chat_groups').update({ messages: newMessages }).eq('id', groupId);
  }
};