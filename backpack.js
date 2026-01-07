/**
 * Tibia-Style Backpack System for Portals
 * Features quantity-based sprites and retro MMORPG feel
 */

class TibiaBackpack {
  constructor(options = {}) {
    this.maxSlots = options.maxSlots || 32;
    this.inventory = [];
    this.taskPrefix = options.taskPrefix || 'backpack';
    this.debug = options.debug || false;

    // Item sprite definitions with quantity-based variations
    // Easy to replace with actual pixel art image paths later!
    this.sprites = {
      gold: {
        1: '🪙',      // single coin
        '2-4': '🪙🪙',   // small pile
        '5-9': '💰',   // medium pile
        '10-24': '💰💰', // stack
        '25-49': '💰💰💰', // big stack
        '50-99': '🏆', // huge pile
        '100+': '👑'   // gold bag
      },
      silver: {
        1: '⚪',
        '2-4': '⚪⚪',
        '5-9': '⚫',
        '10-24': '⚫⚫',
        '25-49': '⚫⚫⚫',
        '50-99': '🔘',
        '100+': '💿'
      },
      diamonds: {
        1: '💎',
        '2-4': '💎💎',
        '5-9': '💎💎💎',
        '10-24': '💠',
        '25-49': '💠💠',
        '50-99': '💠💠💠',
        '100+': '🔷'
      },
      ore: {
        1: '⛏️',
        '2-4': '🪨',
        '5-9': '🪨🪨',
        '10-24': '🗿',
        '25-49': '🗿🗿',
        '50-99': '⛰️',
        '100+': '🏔️'
      },
      sapphire: {
        1: '💙',
        '2-4': '💙💙',
        '5-9': '🔵',
        '10-24': '🔵🔵',
        '25-49': '🔵🔵🔵',
        '50-99': '🔷',
        '100+': '💠'
      },
      'health-potion': {
        1: '🧪',
        '2-5': '🧪🧪',
        '6+': '🧪🧪🧪'
      },
      meat: {
        1: '🥩',
        '2-5': '🥩🥩',
        '6+': '🍖'
      },
      berries: {
        1: '🫐',
        '2-5': '🫐🫐',
        '6+': '🍇'
      },
      cheese: {
        1: '🧀',
        '2-5': '🧀🧀',
        '6+': '🧈'
      }
    };

    // Check if Portals SDK is loaded
    if (typeof PortalsSdk === 'undefined') {
      console.error('PortalsSdk not found!');
    }

    // Initialize message listener
    this.initPortalsMessageListener();

    this.log('Tibia Backpack initialized');
  }

  /**
   * Get the correct sprite based on item type and quantity
   */
  getItemSprite(itemId, quantity) {
    // Extract base item type (e.g., "gold-1" -> "gold")
    const itemType = itemId.split('-')[0];

    const spriteSet = this.sprites[itemType];
    if (!spriteSet) {
      return '📦'; // Default sprite
    }

    // Find matching quantity tier
    if (spriteSet[quantity]) {
      return spriteSet[quantity];
    }

    // Check ranges
    for (const [range, sprite] of Object.entries(spriteSet)) {
      if (range.includes('-')) {
        const [min, max] = range.split('-').map(Number);
        if (quantity >= min && quantity <= max) {
          return sprite;
        }
      } else if (range.includes('+')) {
        const min = parseInt(range);
        if (quantity >= min) {
          return sprite;
        }
      }
    }

    // Default to first sprite
    return spriteSet[1] || '📦';
  }

  /**
   * Send task update to Portals
   */
  sendTaskUpdate(taskName, taskTargetState) {
    if (typeof PortalsSdk === 'undefined') {
      this.log('PortalsSdk not available');
      return;
    }

    const message = {
      TaskName: taskName,
      TaskTargetState: taskTargetState
    };

    try {
      PortalsSdk.sendMessageToUnity(JSON.stringify(message));
      this.log('Sent task:', taskName, '->', taskTargetState);
    } catch (error) {
      console.error('Failed to send task:', error);
    }
  }

  /**
   * Initialize message listener from Portals
   */
  initPortalsMessageListener() {
    if (typeof PortalsSdk !== 'undefined' && PortalsSdk.setMessageListener) {
      PortalsSdk.setMessageListener((message) => {
        this.handlePortalsMessage(message);
      });
      this.log('Portals listener registered');
    } else {
      window.addEventListener('message', (event) => {
        this.handlePortalsMessage(event.data);
      });
      this.log('Fallback listener registered');
    }
  }

  /**
   * Handle messages from Portals
   */
  handlePortalsMessage(message) {
    try {
      let data = message;

      // Ignore non-Portals messages
      if (data && typeof data === 'object' && data.target) {
        return;
      }

      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
          if (data && data.action) {
            this.handleAction(data);
          }
        } catch (e) {
          this.log('Non-JSON string:', data);
        }
      } else if (data && typeof data === 'object' && data.action) {
        this.handleAction(data);
      }
    } catch (error) {
      console.error('[TibiaBackpack] Error:', error);
    }
  }

  /**
   * Handle action commands
   */
  handleAction(message) {
    const { action, ...params } = message;

    try {
      switch (action) {
        case 'addItem':
          this.addItem(params.item, params.quantity || 1);
          break;

        case 'removeItem':
          this.removeItem(params.itemId, params.quantity || 1);
          break;

        case 'clearBackpack':
          this.clearBackpack();
          break;

        case 'getInventory':
          // Could send back to Portals if needed
          this.log('Current inventory:', this.getInventory());
          break;

        default:
          this.log('Unknown action:', action);
      }

      if (window.updateUI) {
        window.updateUI();
      }
    } catch (error) {
      this.log('Error executing action:', action, error.message);
    }
  }

  /**
   * Add item to backpack
   */
  addItem(item, quantity = 1) {
    if (!item.id || !item.name) {
      throw new Error('Invalid item: needs id and name');
    }

    // Check if backpack has space
    if (this.inventory.length >= this.maxSlots) {
      const existing = this.inventory.find(i => i.id === item.id);
      if (!existing) {
        this.sendTaskUpdate('backpack_full', 'SetNotActiveToActive');
        throw new Error('Backpack is full!');
      }
    }

    // Check if item already exists
    const existingIndex = this.inventory.findIndex(i => i.id === item.id);

    if (existingIndex !== -1) {
      // Stack with existing item
      this.inventory[existingIndex].quantity += quantity;
      this.log(`Stacked ${item.name}: +${quantity} (total: ${this.inventory[existingIndex].quantity})`);
    } else {
      // Add new item
      const newItem = {
        ...item,
        quantity,
        addedAt: Date.now()
      };
      this.inventory.push(newItem);
      this.log(`Added ${item.name} x${quantity}`);
    }

    this.sendTaskUpdate(`backpack_item_added_${item.id}`, 'SetNotActiveToCompleted');

    return true;
  }

  /**
   * Remove item from backpack
   */
  removeItem(itemId, quantity = 1) {
    const index = this.inventory.findIndex(i => i.id === itemId);

    if (index === -1) {
      throw new Error(`Item ${itemId} not found`);
    }

    const item = this.inventory[index];

    if (quantity >= item.quantity) {
      // Remove completely
      this.inventory.splice(index, 1);
      this.log(`Removed all ${item.name}`);
    } else {
      // Remove partial
      item.quantity -= quantity;
      this.log(`Removed ${quantity} ${item.name} (${item.quantity} left)`);
    }

    this.sendTaskUpdate(`backpack_item_removed_${itemId}`, 'SetActiveToCompleted');

    return true;
  }

  /**
   * Get specific item
   */
  getItem(itemId) {
    return this.inventory.find(i => i.id === itemId) || null;
  }

  /**
   * Get entire inventory
   */
  getInventory() {
    return {
      items: this.inventory,
      count: this.inventory.length,
      maxSlots: this.maxSlots
    };
  }

  /**
   * Clear backpack
   */
  clearBackpack() {
    const count = this.inventory.length;
    this.inventory = [];
    this.log(`Cleared ${count} items`);
    this.sendTaskUpdate('backpack_cleared', 'SetActiveToCompleted');
    return { cleared: count };
  }

  /**
   * Logging helper
   */
  log(...args) {
    if (this.debug) {
      console.log('[TibiaBackpack]', ...args);
    }
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TibiaBackpack };
}
