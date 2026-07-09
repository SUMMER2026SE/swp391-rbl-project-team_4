const fs = require('fs');
const path = require('path');

const enPath = path.join(__dirname, 'public/locales/en.json');
const viPath = path.join(__dirname, 'public/locales/vi.json');

const enDict = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const viDict = JSON.parse(fs.readFileSync(viPath, 'utf8'));

if (!enDict.fnb) enDict.fnb = {};
if (!viDict.fnb) viDict.fnb = {};

const fnbKeys = {
    "fnb_combo_couple": { vi: "Combo Couple", en: "Couple Combo" },
    "fnb_sweet_popcorn_l": { vi: "Bắp Ngọt Lớn", en: "Sweet Popcorn (L)" },
    "fnb_cheese_popcorn": { vi: "Bắp Phô Mai", en: "Cheese Popcorn" },
    "fnb_nachos_grande": { vi: "Nachos Grande", en: "Nachos Grande" },
    "fnb_combo_family": { vi: "Combo Family", en: "Family Combo" },
    "fnb_combo_solo": { vi: "Combo Solo", en: "Solo Combo" },
    "fnb_coca_l": { vi: "Coca-Cola Lớn", en: "Coca-Cola (L)" },
    "fnb_bottled_water": { vi: "Nước Suối / Dasani", en: "Bottled Water / Dasani" },
    "fnb_peach_tea": { vi: "Trà Đào Cam Sả", en: "Peach & Lemongrass Tea" }
};

Object.keys(fnbKeys).forEach(key => {
    enDict.fnb[key] = fnbKeys[key].en;
    viDict.fnb[key] = fnbKeys[key].vi;
});

const moreAdminKeys = {
    "search_placeholder": { vi: "Tìm kiếm...", en: "Search..." },
    "eg_nachos": { vi: "VD: Nachos...", en: "E.g. Nachos..." },
    "short_desc": { vi: "Mô tả ngắn...", en: "Short description..." },
    "authorized_persons": { vi: "người được cấp quyền", en: "authorized personnel" },
    "customers": { vi: "khách hàng", en: "customers" },
    "active": { vi: "Hoạt động", en: "Active" }
};

Object.keys(moreAdminKeys).forEach(key => {
    enDict.admin[key] = moreAdminKeys[key].en;
    viDict.admin[key] = moreAdminKeys[key].vi;
});

fs.writeFileSync(enPath, JSON.stringify(enDict, null, 4), 'utf8');
fs.writeFileSync(viPath, JSON.stringify(viDict, null, 4), 'utf8');

console.log('Restored all fnb keys and additional admin placeholders!');
