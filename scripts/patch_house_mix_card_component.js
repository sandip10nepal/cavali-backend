const fs = require("fs");
const path = require("path");
const vm = require("vm");

const bundleDir = "public/_expo/static/js/web";
const glob = fs.readdirSync(bundleDir).filter(f => f.endsWith(".js"));

glob.forEach(file => {
  const fullPath = path.join(bundleDir, file);
  let content = fs.readFileSync(fullPath, "utf8");

  // 1. Patch getItemImageSource in module to ALWAYS return null for all Hookah items
  const imgFnIdx = content.indexOf(`e.getItemImageSource=function(_)`);
  if (imgFnIdx !== -1) {
    const origFnHeader = `e.getItemImageSource=function(_){if(!_)return null;`;
    const newFnHeader = `e.getItemImageSource=function(_){if(!_)return null;if(_.category==="hookah"||String(_.category_id||"").toLowerCase().includes("hookah")||_.subcategory==="House Mixes"||/cavalli crush|shah jahan|habibi nights|kashmiri chai|anarkali|white king|zaalim|shokha|dubai nights|dragon/i.test(_.name||""))return null;`;
    if (content.includes(origFnHeader)) {
      content = content.replace(origFnHeader, newFnHeader);
      console.log(`[${file}] Patched getItemImageSource to strip all Hookah images`);
    }
  }

  // 2. Patch ItemDetailModal to hide image container if item is Hookah
  // In ItemDetailModal:
  // s[4]!==j?(O=(0,x.getItemImageSource)(j)...
  // The image wrapper: (0,x.jsxs)(l.default,{style:[C.modalImageWrapper
  // or (0,y.jsxs)(l.default,{style:[h.modalImageWrapper
  // We make sure that if isHookah, the image wrapper is null or hidden!
  const imgWrapRegex = /\(0,[a-zA-Z0-9_]+\.jsxs\)\(([a-zA-Z0-9_]+)\.default,\{style:\[([a-zA-Z0-9_]+)\.modalImageWrapper,([a-zA-Z0-9_]+)&&\{height:([a-zA-Z0-9_]+)\}\],children:\[/;
  if (imgWrapRegex.test(content)) {
    content = content.replace(imgWrapRegex, (match, p1, p2, p3, p4) => {
      return `(j&&(j.category==="hookah"||String(j.category_id||"").toLowerCase().includes("hookah")||j.subcategory==="House Mixes"||/cavalli crush|shah jahan|habibi nights|kashmiri chai|anarkali|white king|zaalim|shokha|dubai nights|dragon/i.test(j.name||"")))?null:(0,y.jsxs)(${p1}.default,{style:[${p2}.modalImageWrapper,${p3}&&{height:${p4}}],children:[`;
    });
    console.log(`[${file}] Patched ItemDetailModal to hide image container for Hookah`);
  }

  // 3. Define HouseMixItemCard component for MenuBrowsing
  const houseMixCompDef = `
function HouseMixItemCard(props) {
  var item = props.item,
      theme = props.theme,
      isMobile = props.isMobile,
      cardWidth = props.cardWidth,
      onAddToCart = props.onAddToCart,
      count = props.count,
      onUpdateQuantity = props.onUpdateQuantity,
      onSelectItem = props.onSelectItem;

  var iceBaseState = o.useState(false);
  var iceBase = iceBaseState[0];
  var setIceBase = iceBaseState[1];

  var iceHoseState = o.useState(false);
  var iceHose = iceHoseState[0];
  var setIceHose = iceHoseState[1];

  var totalPrice = item.price + (iceBase ? 2 : 0) + (iceHose ? 6 : 0);

  // When clicking on the card or Add button, open ItemDetailModal so customer can customize!
  var handleOpenOptions = function(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    if (onSelectItem) {
      onSelectItem(item);
    }
  };

  var handleQuickAddWithSelected = function(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    var selectedOpts = [];
    if (iceBase) selectedOpts.push({ id: "OPT_ICE_BASE", name: "Ice Base", price: 2 });
    if (iceHose) selectedOpts.push({ id: "OPT_ICE_HOSE", name: "Ice Hose", price: 6 });
    if (onAddToCart) {
      onAddToCart(item, 1, selectedOpts);
    }
  };

  return S.jsxs(c.default, {
    activeOpacity: 0.9,
    onPress: handleOpenOptions,
    style: [
      B.itemCard,
      {
        width: cardWidth,
        backgroundColor: theme.cardColor,
        borderColor: count > 0 ? "#10B981" : theme.borderColor,
        borderWidth: count > 0 ? 2 : 1.5,
        padding: isMobile ? 12 : 16,
        marginBottom: 10,
        borderRadius: 18,
        justifyContent: "space-between"
      }
    ],
    children: [
      // Title and Price Row
      S.jsxs(a.default, {
        style: [B.titleRow, { alignItems: "center", marginBottom: 6 }],
        children: [
          S.jsxs(a.default, {
            style: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
            children: [
              S.jsx(i.default, { style: { fontSize: isMobile ? 16 : 20 }, children: "💨" }),
              S.jsx(i.default, {
                style: [B.itemName, { color: theme.textColor, fontSize: isMobile ? 15 : 18, fontWeight: "900" }],
                numberOfLines: 1,
                children: item.name
              })
            ]
          }),
          S.jsxs(i.default, {
            style: [B.itemPrice, { color: theme.secondaryColor, fontSize: isMobile ? 15 : 18, fontWeight: "900" }],
            children: ["$", totalPrice.toFixed(2)]
          })
        ]
      }),

      // Description / Base Note
      item.description ? S.jsxs(a.default, {
        style: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 },
        children: [
          S.jsx(i.default, { style: { fontSize: 11 }, children: "🍇" }),
          S.jsx(i.default, {
            style: [B.itemDesc, { color: "#E5B13A", fontSize: isMobile ? 11 : 12, fontWeight: "700" }],
            numberOfLines: 1,
            children: item.description
          })
        ]
      }) : null,

      // Inline Add-On Options (Ice Base & Ice Hose)
      S.jsxs(a.default, {
        style: { flexDirection: "row", gap: 6, marginBottom: 10 },
        children: [
          // Ice Base Toggle Pill
          S.jsxs(c.default, {
            activeOpacity: 0.8,
            onPress: function(e) {
              if (e && e.stopPropagation) e.stopPropagation();
              setIceBase(!iceBase);
            },
            style: {
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              paddingVertical: isMobile ? 6 : 8,
              paddingHorizontal: 6,
              borderRadius: 10,
              borderWidth: 1.5,
              borderColor: iceBase ? "#0099FF" : "rgba(255,255,255,0.15)",
              backgroundColor: iceBase ? "rgba(0,153,255,0.2)" : "rgba(255,255,255,0.04)"
            },
            children: [
              S.jsx(i.default, { style: { fontSize: isMobile ? 12 : 14 }, children: "🧊" }),
              S.jsx(i.default, {
                style: {
                  color: iceBase ? "#0099FF" : theme.mutedTextColor,
                  fontSize: isMobile ? 10 : 12,
                  fontWeight: "900"
                },
                children: iceBase ? "✓ ICE BASE +$2" : "+ ICE BASE $2"
              })
            ]
          }),

          // Ice Hose Toggle Pill
          S.jsxs(c.default, {
            activeOpacity: 0.8,
            onPress: function(e) {
              if (e && e.stopPropagation) e.stopPropagation();
              setIceHose(!iceHose);
            },
            style: {
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              paddingVertical: isMobile ? 6 : 8,
              paddingHorizontal: 6,
              borderRadius: 10,
              borderWidth: 1.5,
              borderColor: iceHose ? "#14B8A6" : "rgba(255,255,255,0.15)",
              backgroundColor: iceHose ? "rgba(20,184,166,0.2)" : "rgba(255,255,255,0.04)"
            },
            children: [
              S.jsx(i.default, { style: { fontSize: isMobile ? 12 : 14 }, children: "❄️" }),
              S.jsx(i.default, {
                style: {
                  color: iceHose ? "#14B8A6" : theme.mutedTextColor,
                  fontSize: isMobile ? 10 : 12,
                  fontWeight: "900"
                },
                children: iceHose ? "✓ ICE HOSE +$6" : "+ ICE HOSE $6"
              })
            ]
          })
        ]
      }),

      // Action Button Row: Tapping opens customization modal to ask customer!
      S.jsxs(a.default, {
        style: [B.cardBtnRow, { marginTop: 2 }],
        children: [
          count === 0 ? S.jsxs(c.default, {
            onPress: handleOpenOptions,
            activeOpacity: 0.85,
            style: [
              B.quickAddBtn,
              {
                backgroundColor: "#22C55E",
                borderColor: "#22C55E",
                borderWidth: 1.5,
                paddingVertical: isMobile ? 8 : 10,
                width: "100%",
                borderRadius: 12,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6
              }
            ],
            children: [
              S.jsx(h.Plus, { size: isMobile ? 14 : 16, color: "#FFFFFF" }),
              S.jsxs(i.default, {
                style: [B.quickAddText, { color: "#FFFFFF", fontSize: isMobile ? 12 : 13, fontWeight: "900" }],
                children: ["SELECT ADD-ONS & ADD ($", totalPrice.toFixed(2), ")"]
              })
            ]
          }) : S.jsxs(a.default, {
            style: [B.browseStepperRow, { width: "100%", justifyContent: "space-between" }],
            children: [
              S.jsx(c.default, {
                onPress: function(e) {
                  if (e && e.stopPropagation) e.stopPropagation();
                  if (onUpdateQuantity) onUpdateQuantity(item, -1);
                },
                activeOpacity: 0.8,
                style: [B.browseStepBtn, { backgroundColor: "rgba(255,255,255,0.1)", borderColor: theme.borderColor, width: 34, height: 34, borderRadius: 10 }],
                children: S.jsx(h.Minus, { size: 14, color: theme.textColor })
              }),
              S.jsxs(c.default, {
                onPress: handleOpenOptions,
                activeOpacity: 0.8,
                style: [B.browseCountBadge, { backgroundColor: "#10B981", height: 34, paddingHorizontal: 14, borderRadius: 10 }],
                children: [
                  S.jsx(h.Check, { size: 13, color: "#FFFFFF" }),
                  S.jsxs(i.default, {
                    style: [B.browseCountText, { fontSize: 13, color: "#FFFFFF", fontWeight: "900", marginLeft: 4 }],
                    children: [count, " IN ORDER (OPTIONS)"]
                  })
                ]
              }),
              S.jsx(c.default, {
                onPress: handleOpenOptions,
                activeOpacity: 0.8,
                style: [B.browseStepBtn, { backgroundColor: "#22C55E", borderColor: "#22C55E", width: 34, height: 34, borderRadius: 10 }],
                children: S.jsx(h.Plus, { size: 14, color: "#FFFFFF" })
              })
            ]
          })
        ]
      })
    ]
  });
}
`;

  // First remove any old HouseMixItemCard definition if present
  if (content.includes("function HouseMixItemCard(")) {
    const oldDefStart = content.indexOf("function HouseMixItemCard(");
    const oldDefEnd = content.indexOf("const j=e=>{", oldDefStart);
    content = content.substring(0, oldDefStart) + content.substring(oldDefEnd);
  }

  // Insert HouseMixItemCard right before `const j=e=>{`
  content = content.replace("const j=e=>{", `${houseMixCompDef}\nconst j=e=>{`);

  // Now replace the render item check to return HouseMixItemCard
  // Group A bundles (where variables are c.default, P(e), D, etc.)
  const regexRenderA = /\?\(e=\(e,t\)=>\{([\s\S]*?)const o=\(0,y\.getItemImageSource\)\(e\),n="drinks"===e\.category\|\|"hookah"===e\.category;/;
  if (regexRenderA.test(content)) {
    const repl = `?(e=(e,t)=>{const isHouseH=(e.category==="hookah"||(e.category_id&&String(e.category_id).toLowerCase().includes("hookah"))||e.subcategory==="House Mixes"||e.card_type==="house_mix_compact"||/cavalli crush|shah jahan|habibi nights|kashmiri chai|anarkali|white king|zaalim|shokha|dubai nights|dragon/i.test(e.name||""));if(isHouseH){return (0,S.jsx)(HouseMixItemCard,{item:e,theme:J,isMobile:ee,cardWidth:te,onAddToCart:D,count:we[e.id]||0,onUpdateQuantity:ze,onSelectItem:P});}const o=(0,y.getItemImageSource)(e),n="drinks"===e.category||"hookah"===e.category;`;
    content = content.replace(regexRenderA, repl);
  }

  // Group B bundles (where variables are s.default, N(e), D, etc.)
  const regexRenderB = /\?\(e=\(e,t\)=>\{([\s\S]*?)const o=\(0,y\.getItemImageSource\)\(e\),l="drinks"===e\.category\|\|"hookah"===e\.category;/;
  if (regexRenderB.test(content)) {
    const repl = `?(e=(e,t)=>{const isHouseH=(e.category==="hookah"||(e.category_id&&String(e.category_id).toLowerCase().includes("hookah"))||e.subcategory==="House Mixes"||e.card_type==="house_mix_compact"||/cavalli crush|shah jahan|habibi nights|kashmiri chai|anarkali|white king|zaalim|shokha|dubai nights|dragon/i.test(e.name||""));if(isHouseH){return (0,S.jsx)(HouseMixItemCard,{item:e,theme:te,isMobile:ee,cardWidth:le,onAddToCart:D,count:ke[e.id]||0,onUpdateQuantity:ze,onSelectItem:N});}const o=(0,y.getItemImageSource)(e),l="drinks"===e.category||"hookah"===e.category;`;
    content = content.replace(regexRenderB, repl);
  }

  try {
    new vm.Script(content);
    fs.writeFileSync(fullPath, content, "utf8");
    console.log(`[${file}] Saved & validated!`);
  } catch (err) {
    console.error(`[${file}] AST ERROR:`, err.message);
  }
});
