const fs = require("fs");
const path = require("path");
const vm = require("vm");

const brandsData = {
  "Eternal": [
    { name: "Peach Lit", emoji: "🍑", desc: "Sweet Georgia peach with a cool lit chill", color: "#0099FF" },
    { name: "Milkin Cookies", emoji: "🍪", desc: "Creamy baked cookies and sweet vanilla cream", color: "#0099FF" },
    { name: "Blue Lit", emoji: "⚡", desc: "Electric blueberry with an icy menthol kick", color: "#0099FF" },
    { name: "Tropical Ball", emoji: "🌴", desc: "Exotic tropical island punch blend", color: "#0099FF" },
    { name: "Lemon Lit", emoji: "🍋", desc: "Zesty lemon citrus with crisp cooling frost", color: "#0099FF" },
    { name: "Watermelon Lit", emoji: "🍉", desc: "Juicy summer watermelon on crushed ice", color: "#0099FF" },
    { name: "Like Ice", emoji: "❄️", desc: "Sub-zero pure arctic menthol blast", color: "#0099FF" },
    { name: "Smoothie Sunshine", emoji: "☀️", desc: "Rich tropical smoothie fruit cocktail", color: "#0099FF" },
    { name: "Red Lips", emoji: "💋", desc: "Sweet seductive wild berry candy", color: "#0099FF" }
  ],
  "Adalya": [
    { name: "Baghdadi", emoji: "💨", desc: "Grape, peach, mixed berries & fresh mint", color: "#E5B13A" },
    { name: "Lady Killer", emoji: "👑", desc: "Fragrant melon, sweet mango & berries", color: "#E5B13A" },
    { name: "Love 66", emoji: "❤️", desc: "Watermelon, honeydew, passion fruit & mint", color: "#E5B13A" },
    { name: "Baku Nights", emoji: "🌙", desc: "Rich night blend of sweet exotic fruits & mint", color: "#E5B13A" },
    { name: "Skyfall", emoji: "🌌", desc: "Juicy sweet melon, peach & ice mint", color: "#E5B13A" }
  ],
  "Fumari": [
    { name: "Spiced Chai", emoji: "☕", desc: "Warm creamy black tea, cinnamon & cardamom", color: "#14B8A6" },
    { name: "Ambrosia", emoji: "🍈", desc: "Sweet marshmallow, juicy melon & cream", color: "#14B8A6" },
    { name: "White Peach", emoji: "🍑", desc: "Ultra-juicy authentic Georgia white peach", color: "#14B8A6" }
  ],
  "Afzal": [
    { name: "Paan Ras", emoji: "🍃", desc: "Authentic royal betel leaf, rose & menthol", color: "#10B981" },
    { name: "Lychee", emoji: "🌸", desc: "Delicate Asian lychee blossom sweetness", color: "#10B981" },
    { name: "Kiwi Lemonade", emoji: "🥝", desc: "Zesty kiwi crushed into chilled lemonade", color: "#10B981" },
    { name: "Guava", emoji: "🍈", desc: "Fragrant sweet pink tropical guava", color: "#10B981" },
    { name: "Mixed Fruit", emoji: "🍓", desc: "Rich orchard and tropical fruit medley", color: "#10B981" },
    { name: "Choco Crackle", emoji: "🍫", desc: "Rich velvety chocolate crunch", color: "#10B981" },
    { name: "1001 Nights", emoji: "✨", desc: "Exotic Arabian spiced fruit night blend", color: "#10B981" },
    { name: "Chief Commissioner", emoji: "🎖️", desc: "Strong royal spiced blend with paan notes", color: "#10B981" }
  ],
  "Al Fakhar": [
    { name: "Grapes", emoji: "🍇", desc: "Classic sweet Concord purple grape", color: "#EC4899" },
    { name: "Peach", emoji: "🍑", desc: "Ripe sunny peach nectar", color: "#EC4899" },
    { name: "Berry", emoji: "🫐", desc: "Wild forest mixed berry punch", color: "#EC4899" },
    { name: "Vanilla", emoji: "🍦", desc: "Smooth Madagascar sweet vanilla cream", color: "#EC4899" },
    { name: "Cinnamon", emoji: "🪵", desc: "Warm aromatic Ceylon cinnamon spice", color: "#EC4899" },
    { name: "Cinnamon Gum", emoji: "🍬", desc: "Spiced cinnamon chewing gum", color: "#EC4899" },
    { name: "Mint", emoji: "🌿", desc: "Pure fresh garden spearmint leaves", color: "#EC4899" },
    { name: "Rose Cocktail", emoji: "🌹", desc: "Aromatic Damask rose petal preserves", color: "#EC4899" },
    { name: "Pineapple", emoji: "🍍", desc: "Sweet tropical Hawaiian pineapple", color: "#EC4899" },
    { name: "Lemon", emoji: "🍋", desc: "Crisp zesty yellow lemon citrus", color: "#EC4899" },
    { name: "Lemon Mint", emoji: "🍋", desc: "Zesty lemon with refreshing garden mint", color: "#EC4899" },
    { name: "Cocktail", emoji: "🍹", desc: "Vibrant tropical mixed fruit cocktail", color: "#EC4899" },
    { name: "Watermelon", emoji: "🍉", desc: "Crisp refreshing summer watermelon", color: "#EC4899" },
    { name: "Melon", emoji: "🍈", desc: "Sweet golden honeydew melon", color: "#EC4899" },
    { name: "Mango", emoji: "🥭", desc: "Rich tropical Alphonso mango nectar", color: "#EC4899" },
    { name: "Pomegranate", emoji: "🍎", desc: "Tart Mediterranean ruby pomegranate", color: "#EC4899" },
    { name: "Double Apple", emoji: "🍎", desc: "Traditional world-famous aniseed & red apple", color: "#EC4899" },
    { name: "Kiwi", emoji: "🥝", desc: "Sweet & tangy green kiwi fruit", color: "#EC4899" },
    { name: "Guava", emoji: "🍈", desc: "Sweet pink tropical island guava", color: "#EC4899" },
    { name: "Gum", emoji: "🫧", desc: "Classic sweet pink retro bubblegum", color: "#EC4899" },
    { name: "Gum Mint", emoji: "🌿", desc: "Chewing gum infused with icy mint", color: "#EC4899" },
    { name: "Coconut", emoji: "🥥", desc: "Creamy tropical island coconut milk", color: "#EC4899" },
    { name: "Orange", emoji: "🍊", desc: "Sun-kissed Valencia orange citrus", color: "#EC4899" }
  ],
  "Starbuzz": [
    { name: "Safari Melon", emoji: "🍈", desc: "Exotic African sweet melon blend", color: "#8B5CF6" },
    { name: "Irish Peach", emoji: "🍑", desc: "Creamy peach nectar with spiced citrus", color: "#8B5CF6" },
    { name: "Blue Mist", emoji: "🌌", desc: "Iconic sweet blueberry with cool frosty finish", color: "#8B5CF6" },
    { name: "White Peach", emoji: "🍑", desc: "Soft velvety sweet white peach", color: "#8B5CF6" },
    { name: "Green Savior", emoji: "🌿", desc: "Herbal blend of exotic spices & paan", color: "#8B5CF6" },
    { name: "Watermelon Freeze", emoji: "🍉", desc: "Frozen sweet watermelon with icy blast", color: "#8B5CF6" },
    { name: "Code 69", emoji: "⚡", desc: "Passion fruit mixed with citrus cola", color: "#8B5CF6" },
    { name: "Melon Blue", emoji: "🍈", desc: "Juicy sweet melon and blueberry fusion", color: "#8B5CF6" },
    { name: "Geisha", emoji: "👘", desc: "Smooth peach, passion fruit & cooling mint", color: "#8B5CF6" },
    { name: "Exotic Wild Mint", emoji: "🌿", desc: "Intense wild mountain peppermint", color: "#8B5CF6" },
    { name: "Sex on the Beach", emoji: "🏖️", desc: "Vodka-inspired cranberry, orange & peach punch", color: "#8B5CF6" }
  ]
};

let allFlavors = [];
let idCounter = 1;
for (const [brand, list] of Object.entries(brandsData)) {
  for (const item of list) {
    const slug = item.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
    allFlavors.push({
      id: `flv_${slug}_${idCounter++}`,
      name: item.name,
      brand: brand,
      category: brand.toLowerCase(),
      description: item.desc,
      color: item.color,
      emoji: item.emoji,
      tags: [brand.toLowerCase(), item.name.toLowerCase()]
    });
  }
}

console.log(`Generated ${allFlavors.length} flavors across ${Object.keys(brandsData).length} brands!`);

// Module 1945 code
const module1945Code = `__d(function(g,r,i,a,m,e,d){"use strict";
Object.defineProperty(e,'__esModule',{value:!0});
Object.defineProperty(e,"HOOKAH_FLAVORS_DATABASE",{enumerable:!0,get:function(){return s}});
Object.defineProperty(e,"ALL_HOOKAH_FLAVORS",{enumerable:!0,get:function(){return s}});
Object.defineProperty(e,"CAVALLI_HOUSE_MIXES",{enumerable:!0,get:function(){return []}});
Object.defineProperty(e,"POPULAR_MIX_RECIPES",{enumerable:!0,get:function(){return []}});
const s=${JSON.stringify(allFlavors)};
},1945,[]);`;

// Module 1944 code (HookahMixLabModal)
const module1944Code = `__d(function(g,r,i,a,m,_e,d){"use strict";
function e(e){return e&&e.__esModule?e:{default:e}}
Object.defineProperty(_e,'__esModule',{value:!0});
Object.defineProperty(_e,"HookahMixLabModal",{enumerable:!0,get:function(){return HookahMixLabModal}});

var ReactCompiler = r(d[0]);
var React = r(d[1]);
var View = e(r(d[2])).default;
var Text = e(r(d[3])).default;
var StyleSheet = e(r(d[4])).default;
var Modal = e(r(d[5])).default;
var TouchableOpacity = e(r(d[6])).default;
var ScrollView = e(r(d[7])).default;
var TextInput = e(r(d[8])).default;
var Lucide = r(d[9]);
var ThemeHook = r(d[10]);
var LayoutHook = r(d[11]);
var FlavorsModule = r(d[12]);
var JsxRuntime = r(d[13]);

function HookahMixLabModal(props) {
  var visible = props.visible, onClose = props.onClose, onAddMixToCart = props.onAddMixToCart;
  var themeObj = ThemeHook.useRestaurantTheme();
  var w = themeObj.theme;
  var layoutObj = LayoutHook.useResponsiveLayout();
  var isMobile = layoutObj.isMobilePhone;

  var selectedFlavorsState = React.useState([]);
  var selectedFlavors = selectedFlavorsState[0];
  var setSelectedFlavors = selectedFlavorsState[1];

  var mixNameState = React.useState("ROYAL CUSTOM BOWL");
  var mixName = mixNameState[0];
  var setMixName = mixNameState[1];

  var isEditingNameState = React.useState(false);
  var isEditingName = isEditingNameState[0];
  var setIsEditingName = isEditingNameState[1];

  var searchQueryState = React.useState("");
  var searchQuery = searchQueryState[0];
  var setSearchQuery = searchQueryState[1];

  var selectedBrandState = React.useState("ALL");
  var selectedBrand = selectedBrandState[0];
  var setSelectedBrand = selectedBrandState[1];

  var iceBaseState = React.useState(false);
  var iceBase = iceBaseState[0];
  var setIceBase = iceBaseState[1];

  var iceHoseState = React.useState(false);
  var iceHose = iceHoseState[0];
  var setIceHose = iceHoseState[1];

  if (!visible) return null;

  var allFlavorsList = FlavorsModule.HOOKAH_FLAVORS_DATABASE || [];
  var brandsList = ["ALL", "Eternal", "Adalya", "Fumari", "Afzal", "Al Fakhar", "Starbuzz"];

  var filteredFlavors = allFlavorsList.filter(function(flv) {
    var brandMatch = selectedBrand === "ALL" || (flv.brand && flv.brand.toLowerCase() === selectedBrand.toLowerCase());
    if (!brandMatch) return false;
    if (!searchQuery || !searchQuery.trim()) return true;
    var q = searchQuery.toLowerCase().trim();
    return (flv.name || "").toLowerCase().includes(q) || (flv.brand || "").toLowerCase().includes(q) || (flv.description || "").toLowerCase().includes(q);
  });

  // Calculate percentages
  var count = selectedFlavors.length;
  var layers = [];
  if (count > 0) {
    var basePct = Math.floor(100 / count);
    var rem = 100 - (basePct * count);
    layers = selectedFlavors.map(function(flv, idx) {
      return {
        flavor: flv,
        percentage: idx === 0 ? basePct + rem : basePct
      };
    });
  }

  var addFlavor = function(flv) {
    if (selectedFlavors.some(function(f) { return f.id === flv.id; })) return;
    if (selectedFlavors.length >= 5) {
      alert("Maximum 5 flavors allowed in a custom bowl.");
      return;
    }
    var next = selectedFlavors.concat([flv]);
    setSelectedFlavors(next);
    if (mixName === "ROYAL CUSTOM BOWL" || mixName.includes("CREATION")) {
      setMixName(flv.name.toUpperCase() + " ROYAL BLEND");
    }
  };

  var removeFlavor = function(flvId) {
    var next = selectedFlavors.filter(function(f) { return f.id !== flvId; });
    setSelectedFlavors(next);
  };

  var handleSurpriseMe = function() {
    var shuffled = allFlavorsList.slice().sort(function() { return 0.5 - Math.random(); });
    var num = Math.floor(Math.random() * 2) + 2;
    var picked = shuffled.slice(0, num);
    setSelectedFlavors(picked);
    setMixName(picked[0].name.toUpperCase() + " MASTERPIECE");
  };

  var handleClear = function() {
    setSelectedFlavors([]);
    setMixName("MY CUSTOM BOWL");
  };

  var handleAddToCart = function() {
    if (selectedFlavors.length === 0) return;
    var compText = layers.map(function(l) { return l.flavor.name + " (" + l.percentage + "%)"; }).join(" • ");
    var finalPrice = 25 + (iceBase ? 2 : 0) + (iceHose ? 6 : 0);
    var selectedOptions = [];
    if (iceBase) selectedOptions.push({ id: "OPT_ICE_BASE", name: "Ice Base", price: 2 });
    if (iceHose) selectedOptions.push({ id: "OPT_ICE_HOSE", name: "Ice Hose", price: 6 });

    var itemObj = {
      id: "custom_mix_" + Date.now(),
      name: mixName || "Create Custom Hookah Mix",
      price: finalPrice,
      description: "Custom Bowl: " + compText + (iceBase ? " • Ice Base (+$2)" : "") + (iceHose ? " • Ice Hose (+$6)" : ""),
      category: "hookah",
      subcategory: "Custom Mix Lab",
      badge: "🧪 $25 CUSTOM",
      emoji: "🧪"
    };

    onAddMixToCart(itemObj, 1, selectedOptions, "Composition: " + compText);
    onClose();
  };

  var totalPrice = 25 + (iceBase ? 2 : 0) + (iceHose ? 6 : 0);

  var overlayStyle = [styles.overlay, isMobile && { padding: 6 }];
  var containerStyle = [styles.modalContainer, { backgroundColor: w.backgroundColor, borderColor: "#E5B13A" }, isMobile && { width: "100%", height: "100%", borderRadius: 16 }];

  return JsxRuntime.jsx(Modal, {
    visible: visible,
    animationType: "slide",
    transparent: true,
    onRequestClose: onClose,
    children: JsxRuntime.jsx(View, {
      style: overlayStyle,
      children: JsxRuntime.jsxs(View, {
        style: containerStyle,
        children: [
          // Modal Header
          JsxRuntime.jsxs(View, {
            style: [styles.header, { borderBottomColor: w.borderColor }],
            children: [
              JsxRuntime.jsxs(View, {
                style: styles.headerTitleGroup,
                children: [
                  JsxRuntime.jsx(View, {
                    style: [styles.labIconBg, { backgroundColor: "rgba(229,177,58,0.15)" }],
                    children: JsxRuntime.jsx(Text, { style: { fontSize: isMobile ? 18 : 22 }, children: "🧪" })
                  }),
                  JsxRuntime.jsxs(View, {
                    children: [
                      JsxRuntime.jsx(Text, { style: [styles.headerTitle, { color: w.textColor, fontSize: isMobile ? 15 : 18 }], children: "CUSTOM HOOKAH FLAVOR LAB" }),
                      JsxRuntime.jsx(Text, { style: { color: "#E5B13A", fontSize: 11, fontWeight: "800" }, children: "$25.00 BASE • SELECT UP TO 5 FLAVORS" })
                    ]
                  })
                ]
              }),
              JsxRuntime.jsx(TouchableOpacity, {
                onPress: onClose,
                style: [styles.closeBtn, { backgroundColor: "rgba(255,255,255,0.1)" }],
                children: JsxRuntime.jsx(Lucide.X, { size: isMobile ? 18 : 22, color: w.textColor })
              })
            ]
          }),

          // Modal Body
          isMobile
            ? JsxRuntime.jsxs(View, {
                style: { flex: 1 },
                children: [
                  JsxRuntime.jsxs(ScrollView, {
                    style: { flex: 1 },
                    contentContainerStyle: { padding: 12, paddingBottom: 180 },
                    showsVerticalScrollIndicator: false,
                    children: [
                      // Bowl Composition Chamber Card
                      JsxRuntime.jsxs(View, {
                        style: [styles.mobileChamberCard, { backgroundColor: w.cardColor, borderColor: w.borderColor }],
                        children: [
                          JsxRuntime.jsx(View, {
                            style: styles.chamberHeader,
                            children: isEditingName
                              ? JsxRuntime.jsx(TextInput, {
                                  style: [styles.mixNameInput, { color: w.textColor, borderColor: "#E5B13A" }],
                                  value: mixName,
                                  onChangeText: setMixName,
                                  onBlur: function() { setIsEditingName(false); },
                                  autoFocus: true
                                })
                              : JsxRuntime.jsxs(TouchableOpacity, {
                                  onPress: function() { setIsEditingName(true); },
                                  style: styles.mixNameRow,
                                  children: [
                                    JsxRuntime.jsx(Text, { style: [styles.mixNameText, { color: w.textColor, fontSize: 14 }], children: mixName }),
                                    JsxRuntime.jsx(Text, { style: { fontSize: 12 }, children: "✏️" })
                                  ]
                                })
                          }),
                          JsxRuntime.jsxs(View, {
                            style: [styles.visualBowlContainer, { borderColor: "#E5B13A", minHeight: 100, marginBottom: 8 }],
                            children: [
                              JsxRuntime.jsx(View, {
                                style: styles.bowlTopRim,
                                children: JsxRuntime.jsxs(Text, { style: styles.rimText, children: ["BOWL COMPOSITION (", selectedFlavors.length, "/5)"] })
                              }),
                              selectedFlavors.length === 0
                                ? JsxRuntime.jsxs(View, {
                                    style: styles.emptyChamber,
                                    children: [
                                      JsxRuntime.jsx(Text, { style: { fontSize: 24 }, children: "🧪" }),
                                      JsxRuntime.jsx(Text, { style: [styles.emptyChamberTitle, { color: w.textColor, fontSize: 12 }], children: "SELECT FLAVORS BELOW BY BRAND" })
                                    ]
                                  })
                                : JsxRuntime.jsx(View, {
                                    style: styles.bowlLiquidLayers,
                                    children: layers.map(function(item, idx) {
                                      return JsxRuntime.jsx(View, {
                                        style: [styles.flavorLayer, { backgroundColor: item.flavor.color, paddingVertical: 4, paddingHorizontal: 8 }],
                                        children: JsxRuntime.jsxs(View, {
                                          style: styles.layerInfoRow,
                                          children: [
                                            JsxRuntime.jsx(Text, { style: { fontSize: 13 }, children: item.flavor.emoji }),
                                            JsxRuntime.jsx(Text, { style: [styles.layerName, { fontSize: 11 }], numberOfLines: 1, children: item.flavor.brand + " " + item.flavor.name }),
                                            JsxRuntime.jsxs(Text, { style: [styles.layerPct, { fontSize: 11 }], children: [item.percentage, "%"] }),
                                            JsxRuntime.jsx(TouchableOpacity, {
                                              onPress: function() { removeFlavor(item.flavor.id); },
                                              style: [styles.removeLayerBtn, { paddingHorizontal: 6, paddingVertical: 2 }],
                                              children: JsxRuntime.jsx(Lucide.Trash2, { size: 11, color: "#FFFFFF" })
                                            })
                                          ]
                                        })
                                      }, item.flavor.id || "mix_m_" + idx);
                                    })
                                  })
                            ]
                          })
                        ]
                      }),

                      // Brand Filter Pills
                      JsxRuntime.jsx(ScrollView, {
                        horizontal: true,
                        showsHorizontalScrollIndicator: false,
                        style: { marginBottom: 8 },
                        contentContainerStyle: { gap: 6 },
                        children: brandsList.map(function(bName) {
                          var isAct = selectedBrand.toLowerCase() === bName.toLowerCase();
                          return JsxRuntime.jsx(TouchableOpacity, {
                            onPress: function() { setSelectedBrand(bName); },
                            style: [styles.brandPill, isAct ? { backgroundColor: "#E5B13A", borderColor: "#E5B13A" } : { backgroundColor: w.cardColor, borderColor: w.borderColor }],
                            children: JsxRuntime.jsx(Text, { style: [styles.brandPillText, { color: isAct ? "#000000" : w.mutedTextColor }], children: bName.toUpperCase() })
                          }, "brand_m_" + bName);
                        })
                      }),

                      // Search Input
                      JsxRuntime.jsx(View, {
                        style: styles.filterControlBlock,
                        children: JsxRuntime.jsxs(View, {
                          style: [styles.searchBox, { backgroundColor: w.cardColor, borderColor: w.borderColor, paddingVertical: 6 }],
                          children: [
                            JsxRuntime.jsx(Lucide.Search, { size: 16, color: w.mutedTextColor }),
                            JsxRuntime.jsx(TextInput, {
                              style: [styles.searchInput, { color: w.textColor, fontSize: 12 }],
                              placeholder: "Search " + selectedBrand + " Flavors...",
                              placeholderTextColor: w.mutedTextColor,
                              value: searchQuery,
                              onChangeText: setSearchQuery
                            })
                          ]
                        })
                      }),

                      // Flavors List
                      JsxRuntime.jsx(View, {
                        style: styles.flavorCardsGridMobile,
                        children: filteredFlavors.map(function(flv, idx) {
                          var isAdded = selectedFlavors.some(function(f) { return f.id === flv.id; });
                          return JsxRuntime.jsxs(TouchableOpacity, {
                            activeOpacity: 0.88,
                            onPress: function() { isAdded ? removeFlavor(flv.id) : addFlavor(flv); },
                            style: [styles.mobileFlavorRowCard, { backgroundColor: w.cardColor, borderColor: w.borderColor }, isAdded && { borderColor: "#10B981", backgroundColor: "rgba(16,185,129,0.12)", borderWidth: 2 }],
                            children: [
                              JsxRuntime.jsx(Text, { style: { fontSize: 22 }, children: flv.emoji }),
                              JsxRuntime.jsxs(View, {
                                style: { flex: 1, marginHorizontal: 8 },
                                children: [
                                  JsxRuntime.jsxs(View, {
                                    style: { flexDirection: "row", alignItems: "center", gap: 6 },
                                    children: [
                                      JsxRuntime.jsx(Text, { style: [styles.flavorName, { color: w.textColor, fontSize: 13 }], children: flv.name }),
                                      JsxRuntime.jsx(View, {
                                        style: [styles.brandMiniBadge, { backgroundColor: flv.color }],
                                        children: JsxRuntime.jsx(Text, { style: styles.brandMiniBadgeText, children: flv.brand })
                                      })
                                    ]
                                  }),
                                  JsxRuntime.jsx(Text, { style: [styles.flavorDesc, { color: w.mutedTextColor, fontSize: 10 }], numberOfLines: 1, children: flv.description })
                                ]
                              }),
                              JsxRuntime.jsx(TouchableOpacity, {
                                onPress: function() { isAdded ? removeFlavor(flv.id) : addFlavor(flv); },
                                style: [styles.mobileAddBtn, { backgroundColor: isAdded ? "#EF4444" : "#22C55E" }],
                                children: isAdded ? JsxRuntime.jsx(Lucide.Trash2, { size: 14, color: "#FFFFFF" }) : JsxRuntime.jsx(Lucide.Plus, { size: 16, color: "#FFFFFF" })
                              })
                            ]
                          }, flv.id || "flv_m_" + idx);
                        })
                      })
                    ]
                  }),

                  // Mobile Fixed Footer
                  JsxRuntime.jsxs(View, {
                    style: [styles.mobileFixedFooter, { backgroundColor: w.cardColor, borderTopColor: w.borderColor }],
                    children: [
                      // Surprise & Clear Buttons
                      JsxRuntime.jsxs(View, {
                        style: { flexDirection: "row", gap: 8, marginBottom: 8 },
                        children: [
                          JsxRuntime.jsxs(TouchableOpacity, {
                            onPress: handleSurpriseMe,
                            activeOpacity: 0.8,
                            style: [styles.actionPill, { backgroundColor: "#E5B13A", flex: 1, paddingVertical: 8 }],
                            children: [
                              JsxRuntime.jsx(Lucide.Dices, { size: 15, color: "#000000" }),
                              JsxRuntime.jsx(Text, { style: { color: "#000000", fontWeight: "900", fontSize: 11 }, children: "SURPRISE ME" })
                            ]
                          }),
                          selectedFlavors.length > 0 && JsxRuntime.jsxs(TouchableOpacity, {
                            onPress: handleClear,
                            style: [styles.actionPill, { backgroundColor: "rgba(239,68,68,0.15)", borderColor: "#EF4444", paddingHorizontal: 14 }],
                            children: [
                              JsxRuntime.jsx(Lucide.Trash2, { size: 15, color: "#EF4444" }),
                              JsxRuntime.jsx(Text, { style: { color: "#EF4444", fontWeight: "900", fontSize: 11 }, children: "CLEAR" })
                            ]
                          })
                        ]
                      }),

                      // Add-on options: Ice Base & Ice Hose
                      JsxRuntime.jsxs(View, {
                        style: { flexDirection: "row", gap: 8, marginBottom: 8 },
                        children: [
                          JsxRuntime.jsxs(TouchableOpacity, {
                            onPress: function() { setIceBase(!iceBase); },
                            activeOpacity: 0.8,
                            style: [styles.actionPill, { backgroundColor: iceBase ? "rgba(0,153,255,0.25)" : "rgba(255,255,255,0.06)", borderColor: iceBase ? "#0099FF" : "rgba(255,255,255,0.2)", borderWidth: 1.5, flex: 1, paddingVertical: 8 }],
                            children: [
                              JsxRuntime.jsx(Text, { style: { fontSize: 13 }, children: "🧊" }),
                              JsxRuntime.jsx(Text, { style: { color: iceBase ? "#0099FF" : w.textColor, fontWeight: "800", fontSize: 11 }, children: iceBase ? "✓ ICE BASE (+$2)" : "+ ICE BASE (+$2)" })
                            ]
                          }),
                          JsxRuntime.jsxs(TouchableOpacity, {
                            onPress: function() { setIceHose(!iceHose); },
                            activeOpacity: 0.8,
                            style: [styles.actionPill, { backgroundColor: iceHose ? "rgba(20,184,166,0.25)" : "rgba(255,255,255,0.06)", borderColor: iceHose ? "#14B8A6" : "rgba(255,255,255,0.2)", borderWidth: 1.5, flex: 1, paddingVertical: 8 }],
                            children: [
                              JsxRuntime.jsx(Text, { style: { fontSize: 13 }, children: "❄️" }),
                              JsxRuntime.jsx(Text, { style: { color: iceHose ? "#14B8A6" : w.textColor, fontWeight: "800", fontSize: 11 }, children: iceHose ? "✓ ICE HOSE (+$6)" : "+ ICE HOSE (+$6)" })
                            ]
                          })
                        ]
                      }),

                      // Add to Order Button
                      JsxRuntime.jsxs(TouchableOpacity, {
                        onPress: handleAddToCart,
                        disabled: selectedFlavors.length === 0,
                        activeOpacity: 0.88,
                        style: [styles.addMixToOrderBtn, { backgroundColor: "#10B981", paddingVertical: 12 }, selectedFlavors.length === 0 && { opacity: 0.4 }],
                        children: [
                          JsxRuntime.jsx(Text, { style: [styles.addMixText, { fontSize: 13 }], children: "ADD CUSTOM BOWL ($" + totalPrice.toFixed(2) + ")" }),
                          JsxRuntime.jsx(Lucide.ArrowRight, { size: 18, color: "#FFFFFF" })
                        ]
                      })
                    ]
                  })
                ]
              })
            : JsxRuntime.jsxs(View, {
                style: styles.labBody,
                children: [
                  // Left Side: Flavors Explorer
                  JsxRuntime.jsxs(View, {
                    style: styles.flavorExplorerSide,
                    children: [
                      // Brand Filter Tabs
                      JsxRuntime.jsx(ScrollView, {
                        horizontal: true,
                        showsHorizontalScrollIndicator: false,
                        style: { marginBottom: 10 },
                        contentContainerStyle: { gap: 8 },
                        children: brandsList.map(function(bName) {
                          var isAct = selectedBrand.toLowerCase() === bName.toLowerCase();
                          return JsxRuntime.jsx(TouchableOpacity, {
                            onPress: function() { setSelectedBrand(bName); },
                            style: [styles.brandPill, isAct ? { backgroundColor: "#E5B13A", borderColor: "#E5B13A" } : { backgroundColor: w.cardColor, borderColor: w.borderColor }],
                            children: JsxRuntime.jsx(Text, { style: [styles.brandPillText, { color: isAct ? "#000000" : w.mutedTextColor }], children: bName.toUpperCase() })
                          }, "brand_d_" + bName);
                        })
                      }),

                      // Search Box
                      JsxRuntime.jsx(View, {
                        style: styles.filterControlBlock,
                        children: JsxRuntime.jsxs(View, {
                          style: [styles.searchBox, { backgroundColor: w.cardColor, borderColor: w.borderColor }],
                          children: [
                            JsxRuntime.jsx(Lucide.Search, { size: 18, color: w.mutedTextColor }),
                            JsxRuntime.jsx(TextInput, {
                              style: [styles.searchInput, { color: w.textColor }],
                              placeholder: "Search " + selectedBrand + " Flavors...",
                              placeholderTextColor: w.mutedTextColor,
                              value: searchQuery,
                              onChangeText: setSearchQuery
                            })
                          ]
                        })
                      }),

                      // Desktop Flavors Grid
                      JsxRuntime.jsx(ScrollView, {
                        contentContainerStyle: styles.flavorCardsGrid,
                        showsVerticalScrollIndicator: false,
                        children: filteredFlavors.map(function(flv, idx) {
                          var isAdded = selectedFlavors.some(function(f) { return f.id === flv.id; });
                          return JsxRuntime.jsxs(TouchableOpacity, {
                            activeOpacity: 0.85,
                            onPress: function() { isAdded ? removeFlavor(flv.id) : addFlavor(flv); },
                            style: [styles.flavorCard, { backgroundColor: w.cardColor, borderColor: w.borderColor }, isAdded && { borderColor: "#10B981", backgroundColor: "rgba(16,185,129,0.12)", borderWidth: 2 }],
                            children: [
                              JsxRuntime.jsxs(View, {
                                style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
                                children: [
                                  JsxRuntime.jsx(Text, { style: { fontSize: 26 }, children: flv.emoji }),
                                  JsxRuntime.jsx(View, {
                                    style: [styles.brandMiniBadge, { backgroundColor: flv.color }],
                                    children: JsxRuntime.jsx(Text, { style: styles.brandMiniBadgeText, children: flv.brand })
                                  })
                                ]
                              }),
                              JsxRuntime.jsx(Text, { style: [styles.flavorName, { color: w.textColor, marginTop: 4 }], children: flv.name }),
                              JsxRuntime.jsx(Text, { style: [styles.flavorDesc, { color: w.mutedTextColor }], numberOfLines: 2, children: flv.description }),
                              JsxRuntime.jsx(TouchableOpacity, {
                                onPress: function() { isAdded ? removeFlavor(flv.id) : addFlavor(flv); },
                                style: [styles.cardAddBtn, { backgroundColor: isAdded ? "rgba(239,68,68,0.12)" : "transparent", borderColor: isAdded ? "#EF4444" : "#22C55E", borderWidth: 1.5, marginTop: 8 }],
                                children: isAdded
                                  ? JsxRuntime.jsxs(React.Fragment, {
                                      children: [
                                        JsxRuntime.jsx(Lucide.Trash2, { size: 13, color: "#EF4444" }),
                                        JsxRuntime.jsx(Text, { style: [styles.cardAddBtnText, { color: "#EF4444" }], children: "REMOVE" })
                                      ]
                                    })
                                  : JsxRuntime.jsxs(React.Fragment, {
                                      children: [
                                        JsxRuntime.jsx(Lucide.Plus, { size: 13, color: "#22C55E" }),
                                        JsxRuntime.jsx(Text, { style: [styles.cardAddBtnText, { color: "#22C55E" }], children: "ADD TO BOWL" })
                                      ]
                                    })
                              })
                            ]
                          }, flv.id || "flavor_d_" + idx);
                        })
                      })
                    ]
                  }),

                  // Right Side: Mixing Chamber & Options
                  JsxRuntime.jsxs(View, {
                    style: [styles.mixingChamberSide, { backgroundColor: w.cardColor, borderColor: w.borderColor }],
                    children: [
                      JsxRuntime.jsx(View, {
                        style: styles.chamberHeader,
                        children: isEditingName
                          ? JsxRuntime.jsx(TextInput, {
                              style: [styles.mixNameInput, { color: w.textColor, borderColor: "#E5B13A" }],
                              value: mixName,
                              onChangeText: setMixName,
                              onBlur: function() { setIsEditingName(false); },
                              autoFocus: true
                            })
                          : JsxRuntime.jsxs(TouchableOpacity, {
                              onPress: function() { setIsEditingName(true); },
                              style: styles.mixNameRow,
                              children: [
                                JsxRuntime.jsx(Text, { style: [styles.mixNameText, { color: w.textColor }], children: mixName }),
                                JsxRuntime.jsx(Text, { style: { fontSize: 14 }, children: "✏️" })
                              ]
                            })
                      }),

                      JsxRuntime.jsxs(View, {
                        style: [styles.visualBowlContainer, { borderColor: "#E5B13A", flex: 1, marginBottom: 12 }],
                        children: [
                          JsxRuntime.jsx(View, {
                            style: styles.bowlTopRim,
                            children: JsxRuntime.jsx(Text, { style: styles.rimText, children: "CUSTOM HEAT MANAGEMENT BOWL" })
                          }),
                          selectedFlavors.length === 0
                            ? JsxRuntime.jsxs(View, {
                                style: styles.emptyChamber,
                                children: [
                                  JsxRuntime.jsx(Text, { style: { fontSize: 44, marginBottom: 8 }, children: "🧪" }),
                                  JsxRuntime.jsx(Text, { style: [styles.emptyChamberTitle, { color: w.textColor }], children: "YOUR BOWL IS EMPTY" }),
                                  JsxRuntime.jsx(Text, { style: { color: w.mutedTextColor, fontSize: 12, marginTop: 4 }, children: "Select your favorite brand & flavors" })
                                ]
                              })
                            : JsxRuntime.jsx(View, {
                                style: styles.bowlLiquidLayers,
                                children: layers.map(function(item, idx) {
                                  return JsxRuntime.jsx(View, {
                                    style: [styles.flavorLayer, { backgroundColor: item.flavor.color, flex: item.percentage / 100 }],
                                    children: JsxRuntime.jsxs(View, {
                                      style: styles.layerInfoRow,
                                      children: [
                                        JsxRuntime.jsx(Text, { style: { fontSize: 16 }, children: item.flavor.emoji }),
                                        JsxRuntime.jsx(Text, { style: styles.layerName, numberOfLines: 1, children: item.flavor.brand + " • " + item.flavor.name }),
                                        JsxRuntime.jsxs(Text, { style: styles.layerPct, children: [item.percentage, "%"] }),
                                        JsxRuntime.jsxs(TouchableOpacity, {
                                          onPress: function() { removeFlavor(item.flavor.id); },
                                          style: styles.removeLayerBtn,
                                          children: [
                                            JsxRuntime.jsx(Lucide.Trash2, { size: 14, color: "#FFFFFF" }),
                                            JsxRuntime.jsx(Text, { style: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" }, children: "REMOVE" })
                                          ]
                                        })
                                      ]
                                    })
                                  }, item.flavor.id || "mix_layer_d_" + idx);
                                })
                              })
                        ]
                      }),

                      // Action Pills (Surprise & Clear)
                      JsxRuntime.jsxs(View, {
                        style: styles.bowlActionsRow,
                        children: [
                          JsxRuntime.jsxs(TouchableOpacity, {
                            onPress: handleSurpriseMe,
                            activeOpacity: 0.8,
                            style: [styles.actionPill, { backgroundColor: "#E5B13A", flex: 1, paddingVertical: 10 }],
                            children: [
                              JsxRuntime.jsx(Lucide.Dices, { size: 18, color: "#000000" }),
                              JsxRuntime.jsx(Text, { style: [styles.actionPillText, { color: "#000000" }], children: "🎲 SURPRISE ME" })
                            ]
                          }),
                          selectedFlavors.length > 0 && JsxRuntime.jsxs(TouchableOpacity, {
                            onPress: handleClear,
                            style: [styles.actionPill, { backgroundColor: "rgba(239,68,68,0.12)", borderColor: "#EF4444", flex: 1 }],
                            children: [
                              JsxRuntime.jsx(Lucide.Trash2, { size: 18, color: "#EF4444" }),
                              JsxRuntime.jsx(Text, { style: [styles.actionPillText, { color: "#EF4444" }], children: "CLEAR BOWL" })
                            ]
                          })
                        ]
                      }),

                      // Add-on Options: Ice Base & Ice Hose
                      JsxRuntime.jsxs(View, {
                        style: { flexDirection: "row", gap: 8, marginTop: 8, marginBottom: 8 },
                        children: [
                          JsxRuntime.jsxs(TouchableOpacity, {
                            onPress: function() { setIceBase(!iceBase); },
                            activeOpacity: 0.8,
                            style: [styles.actionPill, { backgroundColor: iceBase ? "rgba(0,153,255,0.25)" : "rgba(255,255,255,0.06)", borderColor: iceBase ? "#0099FF" : "rgba(255,255,255,0.2)", borderWidth: 1.5, flex: 1, paddingVertical: 10 }],
                            children: [
                              JsxRuntime.jsx(Text, { style: { fontSize: 14 }, children: "🧊" }),
                              JsxRuntime.jsx(Text, { style: { color: iceBase ? "#0099FF" : w.textColor, fontWeight: "800", fontSize: 12 }, children: iceBase ? "✓ ICE BASE (+$2.00)" : "+ ICE BASE (+$2.00)" })
                            ]
                          }),
                          JsxRuntime.jsxs(TouchableOpacity, {
                            onPress: function() { setIceHose(!iceHose); },
                            activeOpacity: 0.8,
                            style: [styles.actionPill, { backgroundColor: iceHose ? "rgba(20,184,166,0.25)" : "rgba(255,255,255,0.06)", borderColor: iceHose ? "#14B8A6" : "rgba(255,255,255,0.2)", borderWidth: 1.5, flex: 1, paddingVertical: 10 }],
                            children: [
                              JsxRuntime.jsx(Text, { style: { fontSize: 14 }, children: "❄️" }),
                              JsxRuntime.jsx(Text, { style: { color: iceHose ? "#14B8A6" : w.textColor, fontWeight: "800", fontSize: 12 }, children: iceHose ? "✓ ICE HOSE (+$6.00)" : "+ ICE HOSE (+$6.00)" })
                            ]
                          })
                        ]
                      }),

                      // Add to Order Button
                      JsxRuntime.jsxs(TouchableOpacity, {
                        onPress: handleAddToCart,
                        disabled: selectedFlavors.length === 0,
                        activeOpacity: 0.88,
                        style: [styles.addMixToOrderBtn, { backgroundColor: "#10B981", marginTop: 4 }, selectedFlavors.length === 0 && { opacity: 0.4 }],
                        children: [
                          JsxRuntime.jsx(Text, { style: styles.addMixText, children: "ADD CUSTOM BOWL TO ORDER ($" + totalPrice.toFixed(2) + ")" }),
                          JsxRuntime.jsx(Lucide.ArrowRight, { size: 20, color: "#FFFFFF" })
                        ]
                      })
                    ]
                  })
                ]
              })
        ]
      })
    })
  });
}

var styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.92)", alignItems: "center", justifyContent: "center", padding: 12 },
  modalContainer: { width: "98%", height: "94%", borderRadius: 24, borderWidth: 2, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  headerTitleGroup: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
  labIconBg: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontWeight: "900", letterSpacing: 0.8 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  labBody: { flex: 1, flexDirection: "row", padding: 16, gap: 16 },
  flavorExplorerSide: { flex: 1.3 },
  brandPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5, marginRight: 4 },
  brandPillText: { fontWeight: "900", fontSize: 11, letterSpacing: 0.5 },
  filterControlBlock: { marginBottom: 10 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 1.5 },
  searchInput: { flex: 1, padding: 0, fontWeight: "600" },
  flavorCardsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingBottom: 20 },
  flavorCard: { width: "48.5%", borderRadius: 16, borderWidth: 1.5, padding: 12, justifyContent: "space-between" },
  flavorName: { fontWeight: "900" },
  flavorDesc: { fontSize: 11, lineHeight: 14, marginTop: 2 },
  brandMiniBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  brandMiniBadgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" },
  cardAddBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 6, borderRadius: 10 },
  cardAddBtnText: { fontWeight: "900", letterSpacing: 0.5, fontSize: 11 },
  mobileChamberCard: { padding: 12, borderRadius: 16, borderWidth: 1.5, marginBottom: 12 },
  flavorCardsGridMobile: { gap: 8 },
  mobileFlavorRowCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 10, borderRadius: 14, borderWidth: 1.5 },
  mobileAddBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  mobileFixedFooter: { padding: 12, borderTopWidth: 1, position: "relative" },
  mixingChamberSide: { flex: 1, borderRadius: 20, borderWidth: 1.5, padding: 16, justifyContent: "space-between" },
  chamberHeader: { marginBottom: 8 },
  mixNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  mixNameText: { fontWeight: "900" },
  mixNameInput: { fontSize: 16, fontWeight: "900", borderBottomWidth: 1.5, paddingVertical: 2 },
  visualBowlContainer: { borderRadius: 16, borderWidth: 2, overflow: "hidden", backgroundColor: "rgba(0,0,0,0.06)" },
  bowlTopRim: { backgroundColor: "rgba(229,177,58,0.2)", paddingVertical: 3, alignItems: "center" },
  rimText: { color: "#E5B13A", fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
  emptyChamber: { padding: 16, alignItems: "center", justifyContent: "center" },
  emptyChamberTitle: { fontWeight: "900" },
  bowlLiquidLayers: { flex: 1 },
  flavorLayer: { justifyContent: "center", paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.3)" },
  layerInfoRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  layerName: { color: "#FFFFFF", fontWeight: "900", flex: 1 },
  layerPct: { color: "#FFFFFF", fontWeight: "900", marginRight: 6 },
  removeLayerBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(239, 68, 68, 0.85)", borderRadius: 6 },
  bowlActionsRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  actionPill: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1.5 },
  actionPillText: { fontSize: 12, fontWeight: "900", letterSpacing: 0.8 },
  addMixToOrderBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 16 },
  addMixText: { color: "#FFFFFF", fontWeight: "900", letterSpacing: 0.8 }
});
},1944,[12,14,80,167,16,1934,251,179,1828,254,111,1833,1945,6]);`;

// Patch all bundle files
const bundleDir = "public/_expo/static/js/web";
const glob = fs.readdirSync(bundleDir).filter(f => f.endsWith(".js"));

glob.forEach(file => {
  const fullPath = path.join(bundleDir, file);
  let content = fs.readFileSync(fullPath, "utf8");

  // Replace Module 1944
  const mod1944Pattern = /__d\(function\(g,r,i,a,m,_e,d\)[\s\S]*?Object\.defineProperty\(_e,"HookahMixLabModal"[\s\S]*?\},1944,\[12,14,80,167,16,1934,251,179,1828,254,111,1833,1945,6\]\);/;
  if (mod1944Pattern.test(content)) {
    content = content.replace(mod1944Pattern, module1944Code);
  }

  // Replace Module 1945
  const mod1945Pattern = /__d\(function\(g,r,i,a,m,e,d\)[\s\S]*?Object\.defineProperty\(e,"HOOKAH_FLAVORS_DATABASE"[\s\S]*?\},1945,\[\]\);/;
  if (mod1945Pattern.test(content)) {
    content = content.replace(mod1945Pattern, module1945Code);
  }

  try {
    new vm.Script(content);
    fs.writeFileSync(fullPath, content, "utf8");
    console.log("Successfully validated & patched:", file);
  } catch (err) {
    console.error("Syntax check error in", file, err.message);
  }
});
