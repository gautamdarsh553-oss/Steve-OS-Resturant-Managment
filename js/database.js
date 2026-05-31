const DEFAULT_DATABASE = {
  menuItems: [
    { id: 'm1', name: 'Classic Burger', category: 'Burgers', sellingPrice: 8.99, prepTime: 8, icon: '🍔', instructions: 'Grill patty, toast bun, assemble with lettuce, tomato, cheese, and sauce.', recipe: [{ materialId: 'rm1', quantity: 1 }, { materialId: 'rm2', quantity: 1 }, { materialId: 'rm3', quantity: 1 }, { materialId: 'rm4', quantity: 2 }, { materialId: 'rm5', quantity: 2 }], profit: 5.20 },
    { id: 'm2', name: 'Cheese Burger', category: 'Burgers', sellingPrice: 9.99, prepTime: 8, icon: '🧀', instructions: 'Classic burger with double cheese slices.', recipe: [{ materialId: 'rm1', quantity: 1 }, { materialId: 'rm2', quantity: 1 }, { materialId: 'rm3', quantity: 2 }, { materialId: 'rm4', quantity: 2 }, { materialId: 'rm5', quantity: 2 }], profit: 5.70 },
    { id: 'm3', name: 'BBQ Bacon Burger', category: 'Burgers', sellingPrice: 11.99, prepTime: 10, icon: '🥓', instructions: 'Beef patty with bacon, BBQ sauce, onion rings, and cheddar.', recipe: [{ materialId: 'rm14', quantity: 1 }, { materialId: 'rm2', quantity: 1 }, { materialId: 'rm3', quantity: 1 }, { materialId: 'rm15', quantity: 1 }, { materialId: 'rm16', quantity: 1 }], profit: 6.80 },
    { id: 'm4', name: 'Margherita Pizza', category: 'Pizzas', sellingPrice: 12.99, prepTime: 15, icon: '🍕', instructions: 'Stretch dough, spread sauce, add mozzarella, bake until golden.', recipe: [{ materialId: 'rm6', quantity: 1 }, { materialId: 'rm7', quantity: 1 }, { materialId: 'rm8', quantity: 2 }], profit: 7.80 },
    { id: 'm5', name: 'Pepperoni Pizza', category: 'Pizzas', sellingPrice: 14.99, prepTime: 15, icon: '🍕', instructions: 'Margherita with pepperoni slices on top.', recipe: [{ materialId: 'rm6', quantity: 1 }, { materialId: 'rm7', quantity: 1 }, { materialId: 'rm8', quantity: 2 }, { materialId: 'rm9', quantity: 8 }], profit: 8.50 },
    { id: 'm6', name: 'French Fries', category: 'Sides', sellingPrice: 3.99, prepTime: 5, icon: '🍟', instructions: 'Deep fry until golden, season with salt.', recipe: [{ materialId: 'rm10', quantity: 1 }], profit: 2.50 },
    { id: 'm7', name: 'Chicken Wings (6 pcs)', category: 'Sides', sellingPrice: 7.99, prepTime: 10, icon: '🍗', instructions: 'Fry wings, toss in BBQ sauce, serve with ranch.', recipe: [{ materialId: 'rm11', quantity: 6 }, { materialId: 'rm15', quantity: 1 }], profit: 4.20 },
    { id: 'm8', name: 'Soft Drink', category: 'Drinks', sellingPrice: 1.99, prepTime: 1, icon: '🥤', instructions: 'Pour soda from dispenser with ice.', recipe: [{ materialId: 'rm12', quantity: 0.3 }], profit: 1.40 },
    { id: 'm9', name: 'Chicken Wrap', category: 'Sandwiches', sellingPrice: 8.49, prepTime: 8, icon: '🌯', instructions: 'Grill chicken, wrap in tortilla with lettuce, tomato, and sauce.', recipe: [{ materialId: 'rm1', quantity: 1 }, { materialId: 'rm13', quantity: 1 }, { materialId: 'rm4', quantity: 2 }, { materialId: 'rm5', quantity: 2 }], profit: 4.80 },
    { id: 'm10', name: 'Brownie Sundae', category: 'Desserts', sellingPrice: 5.99, prepTime: 3, icon: '🍨', instructions: 'Warm brownie, top with ice cream scoop and chocolate syrup.', recipe: [{ materialId: 'rm18', quantity: 1 }, { materialId: 'rm19', quantity: 1 }], profit: 3.50 },
    { id: 'm11', name: 'Coffee', category: 'Drinks', sellingPrice: 2.99, prepTime: 2, icon: '☕', instructions: 'Brew fresh coffee and serve hot.', recipe: [{ materialId: 'rm20', quantity: 1 }], profit: 2.00 }
  ],
  rawMaterials: [
    { id: 'rm1', name: 'Chicken Patty', type: 'Frozen', unit: 'pcs', quantity: 50, minStock: 10, costPerUnit: 1.50 },
    { id: 'rm2', name: 'Burger Bun', type: 'Bakery', unit: 'pcs', quantity: 60, minStock: 15, costPerUnit: 0.40 },
    { id: 'rm3', name: 'Cheese Slice', type: 'Dairy', unit: 'pcs', quantity: 80, minStock: 20, costPerUnit: 0.30 },
    { id: 'rm4', name: 'Lettuce', type: 'Produce', unit: 'pcs', quantity: 30, minStock: 8, costPerUnit: 0.25 },
    { id: 'rm5', name: 'Tomato', type: 'Produce', unit: 'pcs', quantity: 40, minStock: 10, costPerUnit: 0.20 },
    { id: 'rm6', name: 'Pizza Dough', type: 'Bakery', unit: 'pcs', quantity: 30, minStock: 8, costPerUnit: 1.00 },
    { id: 'rm7', name: 'Pizza Sauce', type: 'Canned', unit: 'cups', quantity: 25, minStock: 5, costPerUnit: 0.75 },
    { id: 'rm8', name: 'Mozzarella', type: 'Dairy', unit: 'cups', quantity: 40, minStock: 10, costPerUnit: 0.90 },
    { id: 'rm9', name: 'Pepperoni', type: 'Frozen', unit: 'pcs', quantity: 60, minStock: 15, costPerUnit: 0.60 },
    { id: 'rm10', name: 'French Fries', type: 'Frozen', unit: 'cups', quantity: 50, minStock: 10, costPerUnit: 0.50 },
    { id: 'rm11', name: 'Chicken Wings', type: 'Frozen', unit: 'pcs', quantity: 80, minStock: 20, costPerUnit: 0.80 },
    { id: 'rm12', name: 'Soda Syrup', type: 'Beverage', unit: 'liters', quantity: 15, minStock: 3, costPerUnit: 2.00 },
    { id: 'rm13', name: 'Flour Tortilla', type: 'Bakery', unit: 'pcs', quantity: 40, minStock: 10, costPerUnit: 0.35 },
    { id: 'rm14', name: 'Ground Beef', type: 'Meat', unit: 'lbs', quantity: 30, minStock: 8, costPerUnit: 2.50 },
    { id: 'rm15', name: 'BBQ Sauce', type: 'Condiment', unit: 'cups', quantity: 20, minStock: 5, costPerUnit: 0.60 },
    { id: 'rm16', name: 'Onion', type: 'Produce', unit: 'pcs', quantity: 35, minStock: 10, costPerUnit: 0.15 },
    { id: 'rm17', name: 'Pickles', type: 'Condiment', unit: 'pcs', quantity: 50, minStock: 10, costPerUnit: 0.10 },
    { id: 'rm18', name: 'Ice Cream Scoop', type: 'Dairy', unit: 'pcs', quantity: 40, minStock: 10, costPerUnit: 0.70 },
    { id: 'rm19', name: 'Brownie', type: 'Bakery', unit: 'pcs', quantity: 30, minStock: 8, costPerUnit: 0.80 },
    { id: 'rm20', name: 'Coffee Beans', type: 'Beverage', unit: 'cups', quantity: 25, minStock: 5, costPerUnit: 0.50 }
  ],
  employees: [],
  attendance: {},
  suppliers: [],
  orders: [],
  salesHistory: [],
  shiftHistory: [],
  shiftActive: false
};

class RestaurantDB {
  constructor() {
    this.key = "steve_restaurant_db";
    this.init();
  }

  init() {
    if (!localStorage.getItem(this.key)) {
      localStorage.setItem(this.key, JSON.stringify({ ...DEFAULT_DATABASE }));
    }
  }

  get() {
    try {
      return JSON.parse(localStorage.getItem(this.key)) || DEFAULT_DATABASE;
    } catch (e) {
      console.error("DB corruption, resetting to default.", e);
      this.reset();
      return DEFAULT_DATABASE;
    }
  }

  save(data) {
    localStorage.setItem(this.key, JSON.stringify(data));
  }

  reset() {
    localStorage.removeItem(this.key);
    this.init();
  }
}

const dbManager = new RestaurantDB();
window.dbManager = dbManager;
