/* ============================================
   REALTIME SUBSCRIPTIONS
   Prompting It - Live Database Updates
   ============================================ */

(function() {
  'use strict';

  // Store active subscriptions for cleanup
  const activeSubscriptions = new Map();

  // ============================================
  // REALTIME SERVICE
  // ============================================
  const RealtimeService = {
    // Subscribe to table changes
    subscribe(table, callback, options = {}) {
      const supabase = window.PromptingItSupabase?.getClient();
      if (!supabase) {
        console.warn('Supabase not initialized for realtime');
        return null;
      }

      const channel = supabase
        .channel(`${table}-changes-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: options.event || '*', // INSERT, UPDATE, DELETE, or *
            schema: 'public',
            table: table,
            filter: options.filter || undefined
          },
          (payload) => {
            callback(payload);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`Subscribed to ${table} changes`);
          }
        });

      // Store for cleanup
      const subscriptionId = `${table}-${Date.now()}`;
      activeSubscriptions.set(subscriptionId, channel);

      return subscriptionId;
    },

    // Unsubscribe from a specific subscription
    unsubscribe(subscriptionId) {
      const supabase = window.PromptingItSupabase?.getClient();
      const channel = activeSubscriptions.get(subscriptionId);
      
      if (channel && supabase) {
        supabase.removeChannel(channel);
        activeSubscriptions.delete(subscriptionId);
      }
    },

    // Unsubscribe from all
    unsubscribeAll() {
      const supabase = window.PromptingItSupabase?.getClient();
      if (!supabase) return;

      activeSubscriptions.forEach((channel) => {
        supabase.removeChannel(channel);
      });
      activeSubscriptions.clear();
    }
  };

  // ============================================
  // SPECIFIC SUBSCRIPTIONS
  // ============================================

  // Subscribe to user's prompts changes
  function subscribeToMyPrompts(userId, callback) {
    return RealtimeService.subscribe('prompts', callback, {
      filter: `user_id=eq.${userId}`
    });
  }

  // Subscribe to marketplace prompts (public prompts)
  function subscribeToMarketplace(callback) {
    return RealtimeService.subscribe('prompts', callback, {
      filter: 'is_marketplace=eq.true'
    });
  }

  // Subscribe to user's purchases
  function subscribeToMyPurchases(userId, callback) {
    return RealtimeService.subscribe('purchases', (payload) => {
      // Only trigger for this user's purchases
      if (payload.new?.buyer_id === userId || payload.old?.buyer_id === userId) {
        callback(payload);
      }
    });
  }

  // Subscribe to user's sales (as seller)
  function subscribeToMySales(userId, callback) {
    return RealtimeService.subscribe('purchases', (payload) => {
      // Only trigger for this user's sales
      if (payload.new?.seller_id === userId || payload.old?.seller_id === userId) {
        callback(payload);
      }
    });
  }

  // Subscribe to user's subscription changes
  function subscribeToMySubscription(userId, callback) {
    return RealtimeService.subscribe('subscriptions', callback, {
      filter: `user_id=eq.${userId}`
    });
  }

  // Subscribe to reviews for a prompt
  function subscribeToPromptReviews(promptId, callback) {
    return RealtimeService.subscribe('reviews', callback, {
      filter: `prompt_id=eq.${promptId}`
    });
  }

  // Subscribe to payout status changes (for creators)
  function subscribeToMyPayouts(userId, callback) {
    return RealtimeService.subscribe('payouts', callback, {
      filter: `user_id=eq.${userId}`
    });
  }

  // Subscribe to activity log (for admins)
  function subscribeToActivity(callback) {
    return RealtimeService.subscribe('activity_log', callback, {
      event: 'INSERT' // Only new activity
    });
  }

  // ============================================
  // PRESENCE (Online Users)
  // ============================================
  const PresenceService = {
    channel: null,
    onlineUsers: new Map(),

    // Track user presence
    async track(userId, userData = {}) {
      const supabase = window.PromptingItSupabase?.getClient();
      if (!supabase) return;

      this.channel = supabase.channel('online-users', {
        config: {
          presence: {
            key: userId
          }
        }
      });

      // Handle presence sync
      this.channel.on('presence', { event: 'sync' }, () => {
        const state = this.channel.presenceState();
        this.onlineUsers.clear();
        Object.entries(state).forEach(([key, value]) => {
          this.onlineUsers.set(key, value[0]);
        });
        window.dispatchEvent(new CustomEvent('presenceUpdate', {
          detail: { onlineUsers: Array.from(this.onlineUsers.values()) }
        }));
      });

      // Handle join
      this.channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
        this.onlineUsers.set(key, newPresences[0]);
        window.dispatchEvent(new CustomEvent('userJoined', {
          detail: { userId: key, user: newPresences[0] }
        }));
      });

      // Handle leave
      this.channel.on('presence', { event: 'leave' }, ({ key }) => {
        this.onlineUsers.delete(key);
        window.dispatchEvent(new CustomEvent('userLeft', {
          detail: { userId: key }
        }));
      });

      // Subscribe and track
      await this.channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await this.channel.track({
            id: userId,
            online_at: new Date().toISOString(),
            ...userData
          });
        }
      });
    },

    // Untrack and leave
    async leave() {
      const supabase = window.PromptingItSupabase?.getClient();
      if (this.channel && supabase) {
        await this.channel.untrack();
        supabase.removeChannel(this.channel);
        this.channel = null;
        this.onlineUsers.clear();
      }
    },

    // Get online users count
    getOnlineCount() {
      return this.onlineUsers.size;
    },

    // Check if user is online
    isOnline(userId) {
      return this.onlineUsers.has(userId);
    }
  };

  // ============================================
  // BROADCAST (Real-time Messaging)
  // ============================================
  const BroadcastService = {
    channels: new Map(),

    // Create a broadcast channel
    create(channelName) {
      const supabase = window.PromptingItSupabase?.getClient();
      if (!supabase) return null;

      const channel = supabase.channel(channelName);
      this.channels.set(channelName, channel);
      return channel;
    },

    // Send a broadcast message
    async send(channelName, event, payload) {
      let channel = this.channels.get(channelName);
      
      if (!channel) {
        channel = this.create(channelName);
        await channel.subscribe();
      }

      return channel.send({
        type: 'broadcast',
        event,
        payload
      });
    },

    // Listen for broadcast messages
    listen(channelName, event, callback) {
      let channel = this.channels.get(channelName);
      
      if (!channel) {
        channel = this.create(channelName);
      }

      channel.on('broadcast', { event }, (payload) => {
        callback(payload.payload);
      });

      channel.subscribe();
      return channel;
    },

    // Remove a channel
    remove(channelName) {
      const supabase = window.PromptingItSupabase?.getClient();
      const channel = this.channels.get(channelName);
      
      if (channel && supabase) {
        supabase.removeChannel(channel);
        this.channels.delete(channelName);
      }
    }
  };

  // ============================================
  // CLEANUP ON PAGE UNLOAD
  // ============================================
  window.addEventListener('beforeunload', () => {
    RealtimeService.unsubscribeAll();
    PresenceService.leave();
    BroadcastService.channels.forEach((_, name) => {
      BroadcastService.remove(name);
    });
  });

  // ============================================
  // EXPORT GLOBAL
  // ============================================
  window.Realtime = {
    // Core
    subscribe: (table, callback, options) => RealtimeService.subscribe(table, callback, options),
    unsubscribe: (id) => RealtimeService.unsubscribe(id),
    unsubscribeAll: () => RealtimeService.unsubscribeAll(),

    // Specific subscriptions
    subscribeToMyPrompts,
    subscribeToMarketplace,
    subscribeToMyPurchases,
    subscribeToMySales,
    subscribeToMySubscription,
    subscribeToPromptReviews,
    subscribeToMyPayouts,
    subscribeToActivity,

    // Presence
    Presence: PresenceService,

    // Broadcast
    Broadcast: BroadcastService
  };

})();

