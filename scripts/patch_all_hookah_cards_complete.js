const fs = require("fs");
const path = require("path");
const vm = require("vm");

const bundleDir = "public/_expo/static/js/web";
const glob = fs.readdirSync(bundleDir).filter(f => f.endsWith(".js"));

glob.forEach(file => {
  const fullPath = path.join(bundleDir, file);
  let content = fs.readFileSync(fullPath, "utf8");

  // 1. Universally patch getItemImageSource to return null for all Hookah items
  const regexImgFn = /e\.getItemImageSource=function\(([a-zA-Z0-9_]+)\)\{if\(!\1\)return null;/g;
  content = content.replace(regexImgFn, (match, arg) => {
    return `e.getItemImageSource=function(${arg}){if(!${arg})return null;if(${arg}.category==="hookah"||String(${arg}.category_id||"").toLowerCase().includes("hookah")||${arg}.subcategory==="House Mixes"||/cavalli crush|shah jahan|habibi nights|kashmiri chai|anarkali|white king|zaalim|shokha|dubai nights|dragon/i.test(${arg}.name||""))return null;`;
  });

  // 2. Patch MenuBrowsing with HouseMixItemCard (inline Ice Base & Ice Hose pills, no modal needed, direct Add to Order)
  if (content.includes("MenuBrowsing")) {
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

  // Directly adds to cart with the selected Ice Base & Ice Hose add-ons!
  var handleAdd = function(e) {
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
    onPress: handleAdd,
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
              paddingVertical: isMobile ? 7 : 9,
              paddingHorizontal: 6,
              borderRadius: 10,
              borderWidth: 1.5,
              borderColor: iceBase ? "#0099FF" : "rgba(255,255,255,0.18)",
              backgroundColor: iceBase ? "rgba(0,153,255,0.22)" : "rgba(255,255,255,0.05)"
            },
            children: [
              S.jsx(i.default, { style: { fontSize: isMobile ? 13 : 15 }, children: "🧊" }),
              S.jsx(i.default, {
                style: {
                  color: iceBase ? "#0099FF" : theme.textColor,
                  fontSize: isMobile ? 11 : 12,
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
              paddingVertical: isMobile ? 7 : 9,
              paddingHorizontal: 6,
              borderRadius: 10,
              borderWidth: 1.5,
              borderColor: iceHose ? "#14B8A6" : "rgba(255,255,255,0.18)",
              backgroundColor: iceHose ? "rgba(20,184,166,0.22)" : "rgba(255,255,255,0.05)"
            },
            children: [
              S.jsx(i.default, { style: { fontSize: isMobile ? 13 : 15 }, children: "❄️" }),
              S.jsx(i.default, {
                style: {
                  color: iceHose ? "#14B8A6" : theme.textColor,
                  fontSize: isMobile ? 11 : 12,
                  fontWeight: "900"
                },
                children: iceHose ? "✓ ICE HOSE +$6" : "+ ICE HOSE $6"
              })
            ]
          })
        ]
      }),

      // Action Button Row
      count === 0 ? S.jsxs(c.default, {
        onPress: handleAdd,
        activeOpacity: 0.85,
        style: [
          B.quickAddBtn,
          {
            backgroundColor: "#22C55E",
            borderColor: "#22C55E",
            borderWidth: 1.5,
            paddingVertical: isMobile ? 9 : 11,
            width: "100%",
            borderRadius: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6
          }
        ],
        children: [
          S.jsx(h.Plus, { size: isMobile ? 15 : 17, color: "#FFFFFF" }),
          S.jsxs(i.default, {
            style: [B.quickAddText, { color: "#FFFFFF", fontSize: isMobile ? 12 : 13, fontWeight: "900" }],
            children: ["ADD TO ORDER ($", totalPrice.toFixed(2), ")"]
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
          S.jsxs(a.default, {
            style: [B.browseCountBadge, { backgroundColor: "#10B981", height: 34, paddingHorizontal: 14, borderRadius: 10 }],
            children: [
              S.jsx(h.Check, { size: 13, color: "#FFFFFF" }),
              S.jsxs(i.default, {
                style: [B.browseCountText, { fontSize: 13, color: "#FFFFFF", fontWeight: "900", marginLeft: 4 }],
                children: [count, " IN ORDER"]
              })
            ]
          }),
          S.jsx(c.default, {
            onPress: handleAdd,
            activeOpacity: 0.8,
            style: [B.browseStepBtn, { backgroundColor: "#22C55E", borderColor: "#22C55E", width: 34, height: 34, borderRadius: 10 }],
            children: S.jsx(h.Plus, { size: 14, color: "#FFFFFF" })
          })
        ]
      })
    ]
  });
}
`;

    // Remove any existing HouseMixItemCard definition
    if (content.includes("function HouseMixItemCard(")) {
      const oldDefStart = content.indexOf("function HouseMixItemCard(");
      const oldDefEnd = content.indexOf("const j=e=>{", oldDefStart);
      content = content.substring(0, oldDefStart) + content.substring(oldDefEnd);
    }

    content = content.replace("const j=e=>{", `${houseMixCompDef}\nconst j=e=>{`);

    // Replace render item in MenuBrowsing
    const regexRenderA = /\?\(e=\(e,t\)=>\{([\s\S]*?)const o=\(0,y\.getItemImageSource\)\(e\),n="drinks"===e\.category\|\|"hookah"===e\.category;/;
    if (regexRenderA.test(content)) {
      const repl = `?(e=(e,t)=>{const isHouseH=(e.category==="hookah"||(e.category_id&&String(e.category_id).toLowerCase().includes("hookah"))||e.subcategory==="House Mixes"||e.card_type==="house_mix_compact"||/cavalli crush|shah jahan|habibi nights|kashmiri chai|anarkali|white king|zaalim|shokha|dubai nights|dragon/i.test(e.name||""));if(isHouseH){return (0,S.jsx)(HouseMixItemCard,{item:e,theme:J,isMobile:ee,cardWidth:te,onAddToCart:D,count:we[e.id]||0,onUpdateQuantity:ze,onSelectItem:P});}const o=(0,y.getItemImageSource)(e),n="drinks"===e.category||"hookah"===e.category;`;
      content = content.replace(regexRenderA, repl);
    }

    const regexRenderB = /\?\(e=\(e,t\)=>\{([\s\S]*?)const o=\(0,y\.getItemImageSource\)\(e\),l="drinks"===e\.category\|\|"hookah"===e\.category;/;
    if (regexRenderB.test(content)) {
      const repl = `?(e=(e,t)=>{const isHouseH=(e.category==="hookah"||(e.category_id&&String(e.category_id).toLowerCase().includes("hookah"))||e.subcategory==="House Mixes"||e.card_type==="house_mix_compact"||/cavalli crush|shah jahan|habibi nights|kashmiri chai|anarkali|white king|zaalim|shokha|dubai nights|dragon/i.test(e.name||""));if(isHouseH){return (0,S.jsx)(HouseMixItemCard,{item:e,theme:te,isMobile:ee,cardWidth:le,onAddToCart:D,count:ke[e.id]||0,onUpdateQuantity:ze,onSelectItem:N});}const o=(0,y.getItemImageSource)(e),l="drinks"===e.category||"hookah"===e.category;`;
      content = content.replace(regexRenderB, repl);
    }
  }

  // 3. Patch ConversationalHost with HostHookahCard (inline Ice Base & Ice Hose pills right on the card!)
  if (content.includes("ConversationalHost")) {
    const hostHookahDef = `
function HostHookahCard(props) {
  var e = props.item,
      R = props.theme,
      A = props.isMobile,
      n = props.count,
      k = props.onAddToCart,
      K = props.setQuantities,
      G = props.setToast,
      z = props.onUpdateQuantity,
      B = props.onRemoveItem,
      F = props.cartItems;

  var iceBaseState = o.default.useState(false);
  var iceBase = iceBaseState[0];
  var setIceBase = iceBaseState[1];

  var iceHoseState = o.default.useState(false);
  var iceHose = iceHoseState[0];
  var setIceHose = iceHoseState[1];

  var totalPrice = e.price + (iceBase ? 2 : 0) + (iceHose ? 6 : 0);

  var handleAdd = function(ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    var selectedOpts = [];
    if (iceBase) selectedOpts.push({ id: "OPT_ICE_BASE", name: "Ice Base", price: 2 });
    if (iceHose) selectedOpts.push({ id: "OPT_ICE_HOSE", name: "Ice Hose", price: 6 });
    if (k) {
      k(e, 1, selectedOpts);
    }
    if (K) {
      K(function(prev) {
        var next = Object.assign({}, prev);
        next[e.id] = (next[e.id] || 0) + 1;
        return next;
      });
    }
    if (G) {
      G(' Added "' + e.name + '" to cart');
      setTimeout(function() { G(null); }, 2200);
    }
  };

  var handleMinus = function(ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    if (K) {
      K(function(prev) {
        var next = Object.assign({}, prev);
        next[e.id] = Math.max(0, (next[e.id] || 0) - 1);
        return next;
      });
    }
    var found = F ? F.find(function(t) { return t.item.id === e.id; }) : null;
    if (found) {
      if (found.quantity > 1 && z) {
        z(found.cartItemId, found.quantity - 1);
      } else if (B) {
        B(found.cartItemId);
      }
    }
  };

  return (0, x.jsxs)(l.default, {
    style: [
      C.portraitProductCard,
      {
        backgroundColor: R.cardColor,
        borderColor: n > 0 ? "#10B981" : R.borderColor,
        borderWidth: n > 0 ? 2 : 1.5,
        padding: A ? 12 : 16,
        borderRadius: 18,
        marginBottom: 12,
        width: A ? "100%" : 320
      }
    ],
    children: [
      // Title Row
      (0, x.jsxs)(l.default, {
        style: [C.productTitleRow, { alignItems: "center", marginBottom: 4, width: "100%", justifyContent: "space-between" }],
        children: [
          (0, x.jsxs)(l.default, {
            style: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
            children: [
              (0, x.jsx)(i.default, { style: { fontSize: A ? 18 : 22 }, children: "💨" }),
              (0, x.jsx)(i.default, {
                style: [C.portraitTitle, { color: R.textColor, fontSize: A ? 15 : 18, fontWeight: "900" }],
                numberOfLines: 1,
                children: e.name
              })
            ]
          }),
          (0, x.jsxs)(i.default, {
            style: [C.portraitPrice, { color: R.secondaryColor, fontSize: A ? 15 : 18, fontWeight: "900" }],
            children: ["$", totalPrice.toFixed(2)]
          })
        ]
      }),

      // Description / Base Note
      e.description ? (0, x.jsxs)(l.default, {
        style: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 },
        children: [
          (0, x.jsx)(i.default, { style: { fontSize: 11 }, children: "🍇" }),
          (0, x.jsx)(i.default, {
            style: [C.portraitDesc, { color: "#E5B13A", fontSize: A ? 11 : 12, fontWeight: "700" }],
            numberOfLines: 1,
            children: e.description
          })
        ]
      }) : null,

      // INLINE ICE BASE & ICE HOSE PILLS (Right on the card!)
      (0, x.jsxs)(l.default, {
        style: { flexDirection: "row", gap: 6, marginBottom: 10, width: "100%" },
        children: [
          // Ice Base Pill
          (0, x.jsxs)(a.default, {
            activeOpacity: 0.8,
            onPress: function(ev) {
              if (ev && ev.stopPropagation) ev.stopPropagation();
              setIceBase(!iceBase);
            },
            style: {
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              paddingVertical: A ? 7 : 9,
              paddingHorizontal: 6,
              borderRadius: 10,
              borderWidth: 1.5,
              borderColor: iceBase ? "#0099FF" : "rgba(255,255,255,0.18)",
              backgroundColor: iceBase ? "rgba(0,153,255,0.22)" : "rgba(255,255,255,0.05)"
            },
            children: [
              (0, x.jsx)(i.default, { style: { fontSize: A ? 13 : 15 }, children: "🧊" }),
              (0, x.jsx)(i.default, {
                style: {
                  color: iceBase ? "#0099FF" : R.textColor,
                  fontSize: A ? 11 : 12,
                  fontWeight: "900"
                },
                children: iceBase ? "✓ ICE BASE +$2" : "+ ICE BASE $2"
              })
            ]
          }),

          // Ice Hose Pill
          (0, x.jsxs)(a.default, {
            activeOpacity: 0.8,
            onPress: function(ev) {
              if (ev && ev.stopPropagation) ev.stopPropagation();
              setIceHose(!iceHose);
            },
            style: {
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              paddingVertical: A ? 7 : 9,
              paddingHorizontal: 6,
              borderRadius: 10,
              borderWidth: 1.5,
              borderColor: iceHose ? "#14B8A6" : "rgba(255,255,255,0.18)",
              backgroundColor: iceHose ? "rgba(20,184,166,0.22)" : "rgba(255,255,255,0.05)"
            },
            children: [
              (0, x.jsx)(i.default, { style: { fontSize: A ? 13 : 15 }, children: "❄️" }),
              (0, x.jsx)(i.default, {
                style: {
                  color: iceHose ? "#14B8A6" : R.textColor,
                  fontSize: A ? 11 : 12,
                  fontWeight: "900"
                },
                children: iceHose ? "✓ ICE HOSE +$6" : "+ ICE HOSE $6"
              })
            ]
          })
        ]
      }),

      // Add to Order Button
      n === 0 ? (0, x.jsxs)(a.default, {
        onPress: handleAdd,
        activeOpacity: 0.85,
        style: [
          C.portraitQuickAddBtn,
          {
            backgroundColor: "#22C55E",
            borderColor: "#22C55E",
            borderWidth: 1.5,
            paddingVertical: A ? 9 : 11,
            width: "100%",
            borderRadius: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6
          }
        ],
        children: [
          (0, x.jsx)(c.Plus, { size: A ? 15 : 17, color: "#FFFFFF" }),
          (0, x.jsxs)(i.default, {
            style: [C.portraitQuickAddText, { color: "#FFFFFF", fontSize: A ? 12 : 13, fontWeight: "900" }],
            children: ["ADD TO ORDER ($", totalPrice.toFixed(2), ")"]
          })
        ]
      }) : (0, x.jsxs)(l.default, {
        style: [C.browseStepperRow, { width: "100%", justifyContent: "space-between", marginTop: 2 }],
        children: [
          (0, x.jsx)(a.default, {
            onPress: handleMinus,
            activeOpacity: 0.8,
            style: [C.browseStepBtn, { backgroundColor: "rgba(255,255,255,0.1)", borderColor: R.borderColor, width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" }],
            children: (0, x.jsx)(c.Minus, { size: 14, color: R.textColor })
          }),
          (0, x.jsxs)(l.default, {
            style: [C.browseCountBadge, { backgroundColor: "#10B981", height: 34, paddingHorizontal: 14, borderRadius: 10, flexDirection: "row", alignItems: "center" }],
            children: [
              (0, x.jsx)(c.Check, { size: 13, color: "#FFFFFF" }),
              (0, x.jsxs)(i.default, {
                style: [C.browseCountText, { fontSize: 13, color: "#FFFFFF", fontWeight: "900", marginLeft: 4 }],
                children: [n, " IN ORDER"]
              })
            ]
          }),
          (0, x.jsx)(a.default, {
            onPress: handleAdd,
            activeOpacity: 0.8,
            style: [C.browseStepBtn, { backgroundColor: "#22C55E", borderColor: "#22C55E", width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" }],
            children: (0, x.jsx)(c.Plus, { size: 14, color: "#FFFFFF" })
          })
        ]
      })
    ]
  });
}
`;

    // Remove any existing HostHookahCard definition
    if (content.includes("function HostHookahCard(")) {
      const oldDefStart = content.indexOf("function HostHookahCard(");
      const oldDefEnd = content.indexOf("const y=({", oldDefStart);
      content = content.substring(0, oldDefStart) + content.substring(oldDefEnd);
    }

    content = content.replace("const y=({", `${hostHookahDef}\nconst y=({`);

    // In ConversationalHost, render HostHookahCard for hookah items:
    const regexHostRender = /children:se\.map\(\(e,t\)=>\{([\s\S]*?)return\(0,x\.jsxs\)\(a\.default,\{activeOpacity:\.88,onPress:\(\)=>j\?j\(e\):le\(e,1\)/;
    if (regexHostRender.test(content)) {
      const repl = `children:se.map((e,t)=>{const isHookah=(e.category==="hookah"||(e.category_id&&String(e.category_id).toLowerCase().includes("hookah"))||e.subcategory==="House Mixes"||/cavalli crush|shah jahan|habibi nights|kashmiri chai|anarkali|white king|zaalim|shokha|dubai nights|dragon/i.test(e.name||""));if(isHookah){return (0,x.jsx)(HostHookahCard,{item:e,theme:R,isMobile:A,count:$[e.id]||0,onAddToCart:k,setQuantities:K,setToast:G,onUpdateQuantity:z,onRemoveItem:B,cartItems:F});}const o=(0,p.getItemImageSource)(e),n=$[e.id]||0;return(0,x.jsxs)(a.default,{activeOpacity:.88,onPress:()=>j?j(e):le(e,1)`;
      content = content.replace(regexHostRender, repl);
    }
  }

  try {
    new vm.Script(content);
    fs.writeFileSync(fullPath, content, "utf8");
    console.log(`[${file}] Patched successfully!`);
  } catch (err) {
    console.error(`[${file}] AST ERROR:`, err.message);
  }
});
