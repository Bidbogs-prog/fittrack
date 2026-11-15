/**
 * Ingredient composition per 100 g, from USDA FoodData Central SR Legacy
 * (April 2018 release, public domain). Generated from the FDC CSV export;
 * granulated sugar's total sugars
 * (not reported in SR Legacy) is set to its sucrose, 99.8 g. Each row keeps its fdcId so a reviewer can check it at
 * https://fdc.nal.usda.gov/food-details/<fdcId>/nutrients. Do not edit by
 * hand: regenerate, or add a new row with its fdcId.
 */

export interface Ingredient {
  fdcId: number | null;
  description: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
  sugar: number | null;
  satFat: number | null;
  sodium: number | null;
}

export const INGREDIENTS = {
  flour: {"fdcId":168894,"description":"Wheat flour, white, all-purpose, enriched, bleached","kcal":364,"protein":10.33,"carbs":76.31,"fat":0.98,"fibre":2.7,"sugar":0.27,"satFat":0.16,"sodium":2},
  flour_whole: {"fdcId":168893,"description":"Wheat flour, whole-grain (Includes foods for USDA's Food Distribution Program)","kcal":340,"protein":13.21,"carbs":71.97,"fat":2.5,"fibre":10.7,"sugar":0.41,"satFat":0.43,"sodium":2},
  semolina: {"fdcId":169715,"description":"Semolina, enriched","kcal":360,"protein":12.68,"carbs":72.83,"fat":1.05,"fibre":3.9,"sugar":null,"satFat":0.15,"sodium":1},
  couscous_dry: {"fdcId":169699,"description":"Couscous, dry","kcal":376,"protein":12.76,"carbs":77.43,"fat":0.64,"fibre":5,"sugar":null,"satFat":0.12,"sodium":10},
  couscous_cooked: {"fdcId":169700,"description":"Couscous, cooked","kcal":112,"protein":3.79,"carbs":23.22,"fat":0.16,"fibre":1.4,"sugar":0.1,"satFat":0.03,"sodium":5},
  rice_cooked: {"fdcId":168878,"description":"Rice, white, long-grain, regular, enriched, cooked","kcal":130,"protein":2.69,"carbs":28.17,"fat":0.28,"fibre":0.4,"sugar":0.05,"satFat":0.08,"sodium":1},
  lentils_dry: {"fdcId":172420,"description":"Lentils, raw","kcal":352,"protein":24.63,"carbs":63.35,"fat":1.06,"fibre":10.7,"sugar":2.03,"satFat":0.15,"sodium":6},
  lentils_cooked: {"fdcId":172421,"description":"Lentils, mature seeds, cooked, boiled, without salt","kcal":116,"protein":9.02,"carbs":20.13,"fat":0.38,"fibre":7.9,"sugar":1.8,"satFat":0.05,"sodium":2},
  chickpeas_dry: {"fdcId":173756,"description":"Chickpeas (garbanzo beans, bengal gram), mature seeds, raw","kcal":378,"protein":20.47,"carbs":62.95,"fat":6.04,"fibre":12.2,"sugar":10.7,"satFat":0.6,"sodium":24},
  chickpeas_cooked: {"fdcId":173757,"description":"Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, without salt","kcal":164,"protein":8.86,"carbs":27.42,"fat":2.59,"fibre":7.6,"sugar":4.8,"satFat":0.27,"sodium":7},
  fava_dry: {"fdcId":175205,"description":"Broadbeans (fava beans), mature seeds, raw","kcal":341,"protein":26.12,"carbs":58.29,"fat":1.53,"fibre":25,"sugar":5.7,"satFat":0.25,"sodium":13},
  fava_cooked: {"fdcId":173753,"description":"Broadbeans (fava beans), mature seeds, cooked, boiled, without salt","kcal":110,"protein":7.6,"carbs":19.65,"fat":0.4,"fibre":5.4,"sugar":1.82,"satFat":0.07,"sodium":5},
  white_beans_dry: {"fdcId":175202,"description":"Beans, white, mature seeds, raw","kcal":333,"protein":23.36,"carbs":60.27,"fat":0.85,"fibre":15.2,"sugar":2.11,"satFat":0.22,"sodium":16},
  white_beans_cooked: {"fdcId":175203,"description":"Beans, white, mature seeds, cooked, boiled, without salt","kcal":139,"protein":9.73,"carbs":25.09,"fat":0.35,"fibre":6.3,"sugar":0.34,"satFat":0.09,"sodium":6},
  pasta_dry: {"fdcId":169736,"description":"Pasta, dry, enriched","kcal":371,"protein":13.04,"carbs":74.67,"fat":1.51,"fibre":3.2,"sugar":2.67,"satFat":0.28,"sodium":6},
  chicken: {"fdcId":171447,"description":"Chicken, broilers or fryers, meat and skin, raw","kcal":215,"protein":18.6,"carbs":0,"fat":15.06,"fibre":0,"sugar":0,"satFat":4.31,"sodium":70},
  chicken_breast: {"fdcId":171077,"description":"Chicken, broiler or fryers, breast, skinless, boneless, meat only, raw","kcal":120,"protein":22.5,"carbs":0,"fat":2.62,"fibre":0,"sugar":0,"satFat":0.56,"sodium":45},
  chicken_roasted: {"fdcId":171450,"description":"Chicken, broilers or fryers, meat and skin, cooked, roasted","kcal":239,"protein":27.3,"carbs":0,"fat":13.6,"fibre":0,"sugar":0,"satFat":3.79,"sodium":82},
  lamb: {"fdcId":172479,"description":"Lamb, composite of trimmed retail cuts, separable lean and fat, trimmed to 1/4\" fat, choice, raw","kcal":267,"protein":16.88,"carbs":0,"fat":21.59,"fibre":0,"sugar":null,"satFat":9.47,"sodium":58},
  lamb_ground: {"fdcId":174370,"description":"Lamb, ground, raw","kcal":282,"protein":16.56,"carbs":0,"fat":23.41,"fibre":0,"sugar":0,"satFat":10.19,"sodium":59},
  beef: {"fdcId":168694,"description":"Beef, round, full cut, separable lean and fat, trimmed to 1/8\" fat, choice, raw","kcal":195,"protein":20.56,"carbs":0,"fat":11.92,"fibre":0,"sugar":0,"satFat":4.63,"sodium":54},
  beef_ground: {"fdcId":171796,"description":"Beef, ground, 85% lean meat / 15% fat, raw (Includes foods for USDA's Food Distribution Program)","kcal":215,"protein":18.59,"carbs":0,"fat":15,"fibre":0,"sugar":0,"satFat":5.72,"sodium":66},
  beef_sausage: {"fdcId":174618,"description":"Sausage, beef, fresh, cooked","kcal":332,"protein":18.21,"carbs":0.35,"fat":27.98,"fibre":0,"sugar":0,"satFat":10.91,"sodium":813},
  egg: {"fdcId":171287,"description":"Egg, whole, raw, fresh","kcal":143,"protein":12.56,"carbs":0.72,"fat":9.51,"fibre":0,"sugar":0.37,"satFat":3.13,"sodium":142},
  whiting: {"fdcId":173713,"description":"Fish, whiting, mixed species, raw","kcal":90,"protein":18.31,"carbs":0,"fat":1.31,"fibre":0,"sugar":0,"satFat":0.25,"sodium":72},
  sardine_canned: {"fdcId":175139,"description":"Fish, sardine, Atlantic, canned in oil, drained solids with bone","kcal":208,"protein":24.62,"carbs":0,"fat":11.45,"fibre":0,"sugar":0,"satFat":1.53,"sodium":307},
  onion: {"fdcId":170000,"description":"Onions, raw","kcal":40,"protein":1.1,"carbs":9.34,"fat":0.1,"fibre":1.7,"sugar":4.24,"satFat":0.04,"sodium":4},
  tomato: {"fdcId":170457,"description":"Tomatoes, red, ripe, raw, year round average","kcal":18,"protein":0.88,"carbs":3.89,"fat":0.2,"fibre":1.2,"sugar":2.63,"satFat":0.03,"sodium":5},
  tomato_paste: {"fdcId":170459,"description":"Tomato products, canned, paste, without salt added (Includes foods for USDA's Food Distribution Program)","kcal":82,"protein":4.32,"carbs":18.91,"fat":0.47,"fibre":4.1,"sugar":12.18,"satFat":0.1,"sodium":59},
  carrot: {"fdcId":170393,"description":"Carrots, raw","kcal":41,"protein":0.93,"carbs":9.58,"fat":0.24,"fibre":2.8,"sugar":4.74,"satFat":0.03,"sodium":69},
  zucchini: {"fdcId":169291,"description":"Squash, summer, zucchini, includes skin, raw","kcal":17,"protein":1.21,"carbs":3.11,"fat":0.32,"fibre":1,"sugar":2.5,"satFat":0.08,"sodium":8},
  potato: {"fdcId":170026,"description":"Potatoes, flesh and skin, raw","kcal":77,"protein":2.05,"carbs":17.49,"fat":0.09,"fibre":2.1,"sugar":0.82,"satFat":0.03,"sodium":6},
  pumpkin: {"fdcId":168448,"description":"Pumpkin, raw","kcal":26,"protein":1,"carbs":6.5,"fat":0.1,"fibre":0.5,"sugar":2.76,"satFat":0.05,"sodium":1},
  turnip: {"fdcId":170465,"description":"Turnips, raw","kcal":28,"protein":0.9,"carbs":6.43,"fat":0.1,"fibre":1.8,"sugar":3.8,"satFat":0.01,"sodium":67},
  cabbage: {"fdcId":169975,"description":"Cabbage, raw","kcal":25,"protein":1.28,"carbs":5.8,"fat":0.1,"fibre":2.5,"sugar":3.2,"satFat":0.03,"sodium":18},
  eggplant: {"fdcId":169228,"description":"Eggplant, raw","kcal":25,"protein":0.98,"carbs":5.88,"fat":0.18,"fibre":3,"sugar":3.53,"satFat":0.03,"sodium":2},
  pepper_green: {"fdcId":170427,"description":"Peppers, sweet, green, raw","kcal":20,"protein":0.86,"carbs":4.64,"fat":0.17,"fibre":1.7,"sugar":2.4,"satFat":0.06,"sodium":3},
  pepper_red: {"fdcId":170108,"description":"Peppers, sweet, red, raw","kcal":26,"protein":0.99,"carbs":6.03,"fat":0.3,"fibre":2.1,"sugar":4.2,"satFat":0.06,"sodium":4},
  peas: {"fdcId":170419,"description":"Peas, green, raw","kcal":81,"protein":5.42,"carbs":14.45,"fat":0.4,"fibre":5.7,"sugar":5.67,"satFat":0.07,"sodium":5},
  cucumber: {"fdcId":168409,"description":"Cucumber, with peel, raw","kcal":15,"protein":0.65,"carbs":3.63,"fat":0.11,"fibre":0.5,"sugar":1.67,"satFat":0.04,"sodium":2},
  celery: {"fdcId":169988,"description":"Celery, raw","kcal":14,"protein":0.69,"carbs":2.97,"fat":0.17,"fibre":1.6,"sugar":1.34,"satFat":0.04,"sodium":80},
  garlic: {"fdcId":169230,"description":"Garlic, raw","kcal":149,"protein":6.36,"carbs":33.06,"fat":0.5,"fibre":2.1,"sugar":1,"satFat":0.09,"sodium":17},
  parsley: {"fdcId":170416,"description":"Parsley, fresh","kcal":36,"protein":2.97,"carbs":6.33,"fat":0.79,"fibre":3.3,"sugar":0.85,"satFat":0.13,"sodium":56},
  mint: {"fdcId":173475,"description":"Spearmint, fresh","kcal":44,"protein":3.29,"carbs":8.41,"fat":0.73,"fibre":6.8,"sugar":null,"satFat":0.19,"sodium":30},
  lemon: {"fdcId":167746,"description":"Lemons, raw, without peel","kcal":29,"protein":1.1,"carbs":9.32,"fat":0.3,"fibre":2.8,"sugar":2.5,"satFat":0.04,"sodium":2},
  olives_green: {"fdcId":169096,"description":"Olives, pickled, canned or bottled, green","kcal":145,"protein":1.03,"carbs":3.84,"fat":15.32,"fibre":3.3,"sugar":0.54,"satFat":2.03,"sodium":1556},
  prunes: {"fdcId":168162,"description":"Plums, dried (prunes), uncooked","kcal":240,"protein":2.18,"carbs":63.88,"fat":0.38,"fibre":7.1,"sugar":38.13,"satFat":0.09,"sodium":2},
  dates: {"fdcId":168191,"description":"Dates, medjool","kcal":277,"protein":1.81,"carbs":74.97,"fat":0.15,"fibre":6.7,"sugar":66.47,"satFat":null,"sodium":1},
  raisins: {"fdcId":168165,"description":"Raisins, dark, seedless (Includes foods for USDA's Food Distribution Program)","kcal":299,"protein":3.3,"carbs":79.32,"fat":0.25,"fibre":4.5,"sugar":65.18,"satFat":0.09,"sodium":26},
  almonds: {"fdcId":170567,"description":"Nuts, almonds","kcal":579,"protein":21.15,"carbs":21.55,"fat":49.93,"fibre":12.5,"sugar":4.35,"satFat":3.8,"sodium":1},
  sesame: {"fdcId":170150,"description":"Seeds, sesame seeds, whole, dried","kcal":573,"protein":17.73,"carbs":23.45,"fat":49.67,"fibre":11.8,"sugar":0.3,"satFat":6.96,"sodium":11},
  walnuts: {"fdcId":170187,"description":"Nuts, walnuts, english","kcal":654,"protein":15.23,"carbs":13.71,"fat":65.21,"fibre":6.7,"sugar":2.61,"satFat":6.13,"sodium":2},
  peanuts: {"fdcId":172430,"description":"Peanuts, all types, raw","kcal":567,"protein":25.8,"carbs":16.13,"fat":49.24,"fibre":8.5,"sugar":4.72,"satFat":6.28,"sodium":18},
  honey: {"fdcId":169640,"description":"Honey","kcal":304,"protein":0.3,"carbs":82.4,"fat":0,"fibre":0.2,"sugar":82.12,"satFat":0,"sodium":4},
  sugar: {"fdcId":169655,"description":"Sugars, granulated","kcal":387,"protein":0,"carbs":99.98,"fat":0,"fibre":0,"sugar":99.8,"satFat":0,"sodium":1},
  olive_oil: {"fdcId":171413,"description":"Oil, olive, salad or cooking","kcal":884,"protein":0,"carbs":0,"fat":100,"fibre":0,"sugar":0,"satFat":13.81,"sodium":2},
  veg_oil: {"fdcId":172370,"description":"Oil, vegetable, soybean, refined","kcal":884,"protein":0,"carbs":0,"fat":100,"fibre":0,"sugar":0,"satFat":15.25,"sodium":0},
  butter: {"fdcId":173430,"description":"Butter, without salt","kcal":717,"protein":0.85,"carbs":0.06,"fat":81.11,"fibre":0,"sugar":0.06,"satFat":50.49,"sodium":11},
  smen: {"fdcId":173412,"description":"Butter oil, anhydrous","kcal":876,"protein":0.28,"carbs":0,"fat":99.48,"fibre":0,"sugar":0,"satFat":61.92,"sodium":2},
  milk: {"fdcId":171265,"description":"Milk, whole, 3.25% milkfat, with added vitamin D","kcal":61,"protein":3.15,"carbs":4.8,"fat":3.25,"fibre":0,"sugar":5.05,"satFat":1.87,"sodium":43},
  buttermilk: {"fdcId":170874,"description":"Milk, buttermilk, fluid, cultured, lowfat","kcal":40,"protein":3.31,"carbs":4.79,"fat":1.07,"fibre":0,"sugar":5.36,"satFat":0.66,"sodium":148},
  yogurt: {"fdcId":171284,"description":"Yogurt, plain, whole milk","kcal":61,"protein":3.47,"carbs":4.66,"fat":3.25,"fibre":0,"sugar":4.66,"satFat":2.1,"sodium":46},
  phyllo: {"fdcId":172791,"description":"Phyllo dough","kcal":299,"protein":7.1,"carbs":52.6,"fat":6,"fibre":1.9,"sugar":0.18,"satFat":1.47,"sodium":483},
  yeast: {"fdcId":175042,"description":"Leavening agents, yeast, baker's, compressed","kcal":105,"protein":8.4,"carbs":18.1,"fat":1.9,"fibre":8.1,"sugar":0,"satFat":0.24,"sodium":30},
  cinnamon: {"fdcId":171320,"description":"Spices, cinnamon, ground","kcal":247,"protein":3.99,"carbs":80.59,"fat":1.24,"fibre":53.1,"sugar":2.17,"satFat":0.35,"sodium":10},
  cumin: {"fdcId":170923,"description":"Spices, cumin seed","kcal":375,"protein":17.81,"carbs":44.24,"fat":22.27,"fibre":10.5,"sugar":2.25,"satFat":1.54,"sodium":168},
  paprika: {"fdcId":171329,"description":"Spices, paprika","kcal":282,"protein":14.14,"carbs":53.99,"fat":12.89,"fibre":34.9,"sugar":10.34,"satFat":2.14,"sodium":68},
  fenugreek: {"fdcId":171324,"description":"Spices, fenugreek seed","kcal":323,"protein":23,"carbs":58.35,"fat":6.41,"fibre":24.6,"sugar":null,"satFat":1.46,"sodium":67},
  anise: {"fdcId":171316,"description":"Spices, anise seed","kcal":337,"protein":17.6,"carbs":50.02,"fat":15.9,"fibre":14.6,"sugar":null,"satFat":0.59,"sodium":16},
  orange_juice: {"fdcId":169098,"description":"Orange juice, raw (Includes foods for USDA's Food Distribution Program)","kcal":45,"protein":0.7,"carbs":10.4,"fat":0.2,"fibre":0.2,"sugar":8.4,"satFat":0.02,"sodium":1},
  avocado: {"fdcId":171705,"description":"Avocados, raw, all commercial varieties","kcal":160,"protein":2,"carbs":8.53,"fat":14.66,"fibre":6.7,"sugar":0.66,"satFat":2.13,"sodium":7},
  banana: {"fdcId":173944,"description":"Bananas, raw","kcal":89,"protein":1.09,"carbs":22.84,"fat":0.33,"fibre":2.6,"sugar":12.23,"satFat":0.11,"sodium":1},
  sardine_proxy: {"fdcId":175119,"description":"Fish, mackerel, Atlantic, raw (proxy for fresh sardine: no raw sardine in SR Legacy)","kcal":205,"protein":18.6,"carbs":0,"fat":13.89,"fibre":0,"sugar":0,"satFat":3.26,"sodium":90},
  water: {"fdcId":null,"description":"Water (tap)","kcal":0,"protein":0,"carbs":0,"fat":0,"fibre":0,"sugar":0,"satFat":0,"sodium":0},
} satisfies Record<string, Ingredient>;

export type IngredientKey = keyof typeof INGREDIENTS;
