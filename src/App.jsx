import { useState, useMemo, useEffect, useRef } from "react";

// ─── CONFIG — edit these before deploying ─────────────────────────────────────
const CONFIG = {
  FLAT_FEE:       499,          // your concierge fee
  ADMIN_PASSWORD: "dealrhckr",  // change this to something private
};
// MarketCheck key goes in Netlify → Environment variables → MARKETCHECK_KEY
// Never put it here — it would be public in your code

// ─── RESPONSIVE ───────────────────────────────────────────────────────────────
function useWidth() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return w;
}

// ─── LOCAL STORAGE (works in every browser, persists across sessions) ─────────
const LS_KEY = "drh_leads_v1";
function lsGet()        { try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; } }
function lsSet(leads)   { try { localStorage.setItem(LS_KEY, JSON.stringify(leads)); }    catch {} }
function lsAdd(lead)    { const ls = lsGet(); ls.unshift(lead); lsSet(ls); }
function lsPatch(id, p) {
  const ls = lsGet();
  const i  = ls.findIndex(l => l.id === id);
  if (i >= 0) ls[i] = { ...ls[i], ...p, updated_at: new Date().toISOString() };
  lsSet(ls);
  return ls;
}

// ─── NETLIFY FORMS — captures lead to your Netlify dashboard ──────────────────
async function submitToNetlify(lead) {
  const fd = new FormData();
  fd.append("form-name", "lead");
  fd.append("lead_id",   lead.id);
  fd.append("name",      lead.name);
  fd.append("phone",     lead.phone);
  fd.append("email",     lead.email);
  fd.append("vehicle",   `${lead.car_year} ${lead.car_make} ${lead.car_model}`);
  fd.append("trim",      lead.car_trim || "");
  fd.append("price",     `$${Number(lead.car_price).toLocaleString()}`);
  fd.append("mileage",   lead.car_miles ? Number(lead.car_miles).toLocaleString() + " mi" : "New");
  fd.append("dealer",    lead.dealer || "");
  fd.append("location",  `${lead.city || ""}${lead.state ? ", " + lead.state : ""}`);
  fd.append("condition", lead.cond || "");
  fd.append("fee",       `$${lead.fee}`);
  fd.append("notes",     lead.notes || "");
  // Honeypot — must be blank
  fd.append("bot-field", "");
  await fetch("/", { method: "POST", body: fd });
}

// ─── MARKETCHECK API — proxied through Netlify Function ───────────────────────
async function fetchInventory({ cond, make, bodyF, fuelF, maxPrice, sf, so, page, per, q, state }) {
  const p = new URLSearchParams();
  p.set("rows",  String(per || 24));
  p.set("start", String(((page || 1) - 1) * (per || 24)));
  if (cond && cond !== "all")         p.set("car_type",   cond);
  if (make && make !== "All")         p.set("make",        make);
  if (state && state !== "All")       p.set("state",       state);
  if (bodyF)                          p.set("body_style",  bodyF);
  if (fuelF)                          p.set("fuel_type",   fuelF);
  if (maxPrice && maxPrice < 300000)  p.set("max_price",   String(maxPrice));
  if (sf)                             p.set("sort_by",     sf);
  if (so)                             p.set("sort_order",  so);
  if (q?.trim())                      p.set("q",           q.trim());

  // Calls our Netlify Function — not MarketCheck directly
  const res = await fetch(`/.netlify/functions/inventory?${p}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

function normalizeCar(l) {
  const b = l.build || {};
  return {
    id: l.id, vin: l.vin, year: b.year, make: b.make, model: b.model, trim: b.trim,
    body: b.body_type, color: l.exterior_color, miles: l.miles, price: l.price,
    msrp: l.msrp, cond: l.car_type || "used", fuel: b.fuel_type, drive: b.drivetrain,
    engine: b.engine, trans: b.transmission, mpg_city: b.city_miles, mpg_hwy: b.highway_miles,
    dealer: l.dealer?.name, city: l.dealer?.city, state: l.dealer?.state,
    phone: l.dealer?.phone, listing_url: l.vdp_url,
    photo: l.media?.photo_links?.[0] || null, dom: l.dom,
  };
}

// ─── MOCK INVENTORY (shown until MarketCheck key is set) ──────────────────────
const MOCK = [
  {id:"m1", year:2023,make:"Toyota",   model:"RAV4 Hybrid",    trim:"XLE Premium AWD",      price:33480,miles:14200,cond:"used",     body:"SUV",  fuel:"Hybrid",  drive:"AWD",engine:"2.5L I-4 Hybrid",   mpg_city:41,mpg_hwy:38, color:"Silver Sky",    dealer:"Capitol Toyota",       city:"San Jose",     state:"CA"},
  {id:"m2", year:2025,make:"Ford",     model:"Mustang",        trim:"GT Premium",           price:49200,miles:0,    cond:"new",      body:"Coupe",fuel:"Gas",     drive:"RWD",engine:"5.0L V8 Coyote",    mpg_city:16,mpg_hwy:24, color:"Grabber Blue",  dealer:"AutoNation Ford",      city:"Dallas",       state:"TX"},
  {id:"m3", year:2022,make:"Tesla",    model:"Model Y",        trim:"Long Range AWD",       price:41800,miles:19400,cond:"used",     body:"SUV",  fuel:"Electric",drive:"AWD",engine:"Dual Motor EV",     mpg_city:null,mpg_hwy:null,color:"Midnight Silver",dealer:"Tesla Miami",          city:"Miami",        state:"FL"},
  {id:"m4", year:2023,make:"BMW",      model:"M3",             trim:"Competition xDrive",   price:82500,miles:8900, cond:"certified",body:"Sedan",fuel:"Gas",     drive:"AWD",engine:"3.0L TwinPower",    mpg_city:17,mpg_hwy:25, color:"Brooklyn Grey", dealer:"BMW of Chicago",       city:"Chicago",      state:"IL"},
  {id:"m5", year:2024,make:"Rivian",   model:"R1T",            trim:"Adventure Dual",       price:73000,miles:3200, cond:"used",     body:"Truck",fuel:"Electric",drive:"AWD",engine:"Dual Motor EV",     mpg_city:null,mpg_hwy:null,color:"Forest Green",  dealer:"Rivian Seattle",       city:"Seattle",      state:"WA"},
  {id:"m6", year:2022,make:"Porsche",  model:"Taycan",         trim:"4S AWD",               price:94000,miles:14800,cond:"used",     body:"Sedan",fuel:"Electric",drive:"AWD",engine:"Dual Motor EV",     mpg_city:null,mpg_hwy:null,color:"Frozen Blue",   dealer:"Porsche Atlanta",      city:"Atlanta",      state:"GA"},
  {id:"m7", year:2023,make:"Honda",    model:"Accord",         trim:"Sport Hybrid",         price:32100,miles:11200,cond:"used",     body:"Sedan",fuel:"Hybrid",  drive:"FWD",engine:"2.0L I-4 Hybrid",   mpg_city:51,mpg_hwy:44, color:"Sonic Gray",    dealer:"Stevens Creek Honda",  city:"Santa Clara",  state:"CA"},
  {id:"m8", year:2025,make:"Toyota",   model:"4Runner",        trim:"TRD Pro 4WD",          price:64900,miles:0,    cond:"new",      body:"SUV",  fuel:"Gas",     drive:"4WD",engine:"2.4L Turbo I-4",    mpg_city:16,mpg_hwy:19, color:"Heavy Metal",   dealer:"Toyota of Houston",    city:"Houston",      state:"TX"},
  {id:"m9", year:2022,make:"Audi",     model:"RS6 Avant",      trim:"Premium Plus",         price:118000,miles:12300,cond:"used",   body:"Wagon",fuel:"Gas",     drive:"AWD",engine:"4.0L TFSI V8",      mpg_city:15,mpg_hwy:22, color:"Nardo Gray",    dealer:"Audi of Manhattan",    city:"New York",     state:"NY"},
  {id:"m10",year:2023,make:"Ford",     model:"F-150 Lightning", trim:"Platinum",            price:89000,miles:7400, cond:"used",     body:"Truck",fuel:"Electric",drive:"AWD",engine:"Dual Motor EV",     mpg_city:null,mpg_hwy:null,color:"Antimatter Blue",dealer:"Ford of Denver",       city:"Denver",       state:"CO"},
  {id:"m11",year:2024,make:"Hyundai",  model:"IONIQ 5",        trim:"Limited AWD",          price:51400,miles:4100, cond:"used",     body:"SUV",  fuel:"Electric",drive:"AWD",engine:"Dual Motor EV",     mpg_city:null,mpg_hwy:null,color:"Atlas White",   dealer:"Hyundai Nashville",    city:"Nashville",    state:"TN"},
  {id:"m12",year:2022,make:"Porsche",  model:"Macan",          trim:"S AWD",                price:58400,miles:17300,cond:"used",     body:"SUV",  fuel:"Gas",     drive:"AWD",engine:"2.9L Biturbo V6",   mpg_city:17,mpg_hwy:23, color:"Carmine Red",   dealer:"Porsche of Boston",    city:"Boston",       state:"MA"},
  {id:"m13",year:2025,make:"Subaru",   model:"WRX",            trim:"GT",                   price:37895,miles:0,    cond:"new",      body:"Sedan",fuel:"Gas",     drive:"AWD",engine:"2.4L Turbo H-4",    mpg_city:19,mpg_hwy:26, color:"WR Blue",       dealer:"Subaru of Portland",   city:"Portland",     state:"OR"},
  {id:"m14",year:2023,make:"GMC",      model:"Sierra 1500",    trim:"Denali Ultimate",      price:72900,miles:21800,cond:"used",     body:"Truck",fuel:"Gas",     drive:"4WD",engine:"3.0L Duramax",      mpg_city:23,mpg_hwy:29, color:"Onyx Black",    dealer:"GMC of Phoenix",       city:"Phoenix",      state:"AZ"},
  {id:"m15",year:2024,make:"Mercedes", model:"G-Class",        trim:"G 550 4MATIC",         price:156000,miles:2200,cond:"used",     body:"SUV",  fuel:"Gas",     drive:"4WD",engine:"4.0L Biturbo V8",   mpg_city:13,mpg_hwy:17, color:"Obsidian Black",dealer:"MB Beverly Hills",     city:"Beverly Hills",state:"CA"},
  {id:"m16",year:2023,make:"Chevrolet",model:"Corvette",       trim:"Z06 Coupe",            price:119000,miles:4800,cond:"used",     body:"Coupe",fuel:"Gas",     drive:"RWD",engine:"5.5L Flat-Plane V8",mpg_city:13,mpg_hwy:20, color:"Amplify Orange",dealer:"Chevy Las Vegas",      city:"Las Vegas",    state:"NV"},
  {id:"m17",year:2022,make:"Lincoln",  model:"Navigator",      trim:"Black Label L AWD",    price:107000,miles:18400,cond:"certified",body:"SUV", fuel:"Gas",     drive:"AWD",engine:"3.5L EcoBoost V6",  mpg_city:16,mpg_hwy:22, color:"Infinite Black",dealer:"Lincoln Minneapolis",  city:"Minneapolis",  state:"MN"},
  {id:"m18",year:2025,make:"Kia",      model:"EV6",            trim:"GT AWD",               price:61900,miles:0,    cond:"new",      body:"SUV",  fuel:"Electric",drive:"AWD",engine:"Dual Motor EV",     mpg_city:null,mpg_hwy:null,color:"Runway Red",    dealer:"Kia Philadelphia",     city:"Philadelphia", state:"PA"},
  {id:"m19",year:2021,make:"Toyota",   model:"Tacoma",         trim:"TRD Off-Road 4x4",     price:36100,miles:29700,cond:"used",     body:"Truck",fuel:"Gas",     drive:"4WD",engine:"3.5L V6",            mpg_city:18,mpg_hwy:22, color:"Midnight Black",dealer:"Toyota of Austin",     city:"Austin",       state:"TX"},
  {id:"m20",year:2024,make:"Cadillac", model:"Escalade",       trim:"Sport Platinum AWD",   price:112000,miles:5400,cond:"used",     body:"SUV",  fuel:"Gas",     drive:"AWD",engine:"6.2L V8",            mpg_city:14,mpg_hwy:18, color:"Black Raven",   dealer:"Cadillac Detroit",     city:"Detroit",      state:"MI"},
  {id:"m21",year:2023,make:"Tesla",    model:"Model 3",        trim:"Long Range AWD",       price:34900,miles:12050,cond:"used",     body:"Sedan",fuel:"Electric",drive:"AWD",engine:"Dual Motor EV",     mpg_city:null,mpg_hwy:null,color:"Pearl White",   dealer:"Tesla Charlotte",      city:"Charlotte",    state:"NC"},
  {id:"m22",year:2025,make:"Honda",    model:"Pilot",          trim:"TrailSport AWD",       price:48200,miles:0,    cond:"new",      body:"SUV",  fuel:"Gas",     drive:"AWD",engine:"3.5L V6",            mpg_city:20,mpg_hwy:27, color:"Sonic Gray",    dealer:"Honda San Antonio",    city:"San Antonio",  state:"TX"},
  {id:"m23",year:2022,make:"BMW",      model:"X5",             trim:"xDrive40i M Sport",    price:66800,miles:24100,cond:"used",     body:"SUV",  fuel:"Gas",     drive:"AWD",engine:"3.0L TwinPower",    mpg_city:21,mpg_hwy:26, color:"Alpine White",  dealer:"BMW San Diego",        city:"San Diego",    state:"CA"},
  {id:"m24",year:2023,make:"RAM",      model:"1500 TRX",       trim:"Launch Edition",       price:98000,miles:8300, cond:"used",     body:"Truck",fuel:"Gas",     drive:"4WD",engine:"6.2L Supercharged",  mpg_city:10,mpg_hwy:14, color:"Granite Crystal",dealer:"RAM Jacksonville",    city:"Jacksonville", state:"FL"},
];

const MAKES  = ["All","Audi","BMW","Cadillac","Chevrolet","Ford","GMC","Honda","Hyundai","Kia","Lincoln","Mercedes","Porsche","RAM","Rivian","Subaru","Tesla","Toyota"];
const BODIES = ["All","SUV","Sedan","Truck","Coupe","Wagon"];
const STATES = ["All","AK","AL","AR","AZ","CA","CO","CT","DE","FL","GA","HI","IA","ID","IL","IN","KS","KY","LA","MA","MD","ME","MI","MN","MO","MS","MT","NC","ND","NE","NH","NJ","NM","NV","NY","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VA","VT","WA","WI","WV","WY"];
const STATUS_META = {
  New:         { bg:"#eff6ff",text:"#1d4ed8",dot:"#3b82f6" },
  Contacted:   { bg:"#fefce8",text:"#854d0e",dot:"#eab308" },
  Negotiating: { bg:"#fdf4ff",text:"#6b21a8",dot:"#a855f7" },
  Won:         { bg:"#f0fdf4",text:"#14532d",dot:"#22c55e" },
  Lost:        { bg:"#fef2f2",text:"#7f1d1d",dot:"#ef4444" },
};
const $   = n => n != null ? "$" + Number(n).toLocaleString() : "—";
const mi  = n => n ? Number(n).toLocaleString() + " mi" : "New";
const uid = () => "DH-" + Date.now().toString(36).toUpperCase().slice(-5) + Math.random().toString(36).slice(2,5).toUpperCase();
const TAX = 0.10;
function calcMo(otd,dn,mo,apr){ const loan=otd-dn; if(loan<=0) return 0; const r=apr/100/12; if(r===0) return Math.round(loan/mo); return Math.round(loan*r*Math.pow(1+r,mo)/(Math.pow(1+r,mo)-1)); }
const T = { bg:"#f5f5f7",card:"#fff",ink:"#1d1d1f",soft:"#6e6e73",faint:"#86868b",line:"rgba(0,0,0,.08)",green:"#00b67a",greenBg:"rgba(0,182,122,.08)",greenBdr:"rgba(0,182,122,.2)",dark:"#1d1d1f" };

export default function App() {
  const w = useWidth(); const mobile = w < 768;
  const [view,       setView]      = useState("home");
  const [car,        setCar]       = useState(null);
  const [modal,      setModal]     = useState(false);
  const [confLead,   setConfLead]  = useState(null);
  const [q,          setQ]         = useState("");
  const [cond,       setCond]      = useState("all");
  const [make,       setMake]      = useState("All");
  const [body,       setBody]      = useState("All");
  const [stateF,     setStateF]    = useState("All");
  const [maxP,       setMaxP]      = useState(300000);
  const [sort,       setSort]      = useState("default");
  const [liveCars,   setLiveCars]  = useState([]);
  const [liveTotal,  setLiveTotal] = useState(0);
  const [loading,    setLoading]   = useState(false);
  const [apiErr,     setApiErr]    = useState(null);
  const [liveReady,  setLiveReady] = useState(false);  // true once first successful MC call
  const [page,       setPage]      = useState(1);
  const PER = 24; const deb = useRef(null);
  const [downPct,    setDownPct]   = useState(10);
  const [termMo,     setTermMo]    = useState(60);
  const [apr,        setApr]       = useState(6.9);
  const [form,       setForm]      = useState({name:"",phone:"",email:"",notes:""});
  const [submitting, setSubmitting]= useState(false);
  const [authed,     setAuthed]    = useState(false);
  const [passIn,     setPassIn]    = useState("");
  const [passErr,    setPassErr]   = useState(false);
  const [leads,      setLeads]     = useState([]);
  const [activeL,    setActiveL]   = useState(null);
  const [sNote,      setSNote]     = useState("");

  const go = v => { window.scrollTo({top:0}); setView(v); };

  // Fetch live inventory via Netlify Function
  useEffect(() => {
    clearTimeout(deb.current);
    deb.current = setTimeout(async () => {
      setLoading(true); setApiErr(null);
      let bodyF=null, fuelF=null;
      if (body !== "All") { if (body==="Electric") fuelF="Electric"; else bodyF={SUV:"SUV",Sedan:"Sedan",Truck:"Pickup Truck",Coupe:"Coupe",Wagon:"Wagon"}[body]||body; }
      let sf=null,so=null;
      if(sort==="price_asc"){sf="price";so="asc";} if(sort==="price_desc"){sf="price";so="desc";}
      if(sort==="miles_asc"){sf="miles";so="asc";} if(sort==="year_desc"){sf="year";so="desc";}
      try {
        const data = await fetchInventory({cond,make,bodyF,fuelF,maxPrice:maxP<300000?maxP:null,sf,so,page,per:PER,q,state:stateF});
        setLiveCars((data.listings||[]).map(normalizeCar));
        setLiveTotal(data.totalCount||0);
        setLiveReady(true);
      } catch(e) {
        // If function not set up yet, fall through to mock data silently
        if (e.message.includes("MARKETCHECK_KEY")) {
          setLiveReady(false);
        } else {
          setApiErr(e.message);
        }
        setLiveCars([]);
      }
      setLoading(false);
    }, 500);
  }, [cond, make, body, stateF, maxP, sort, page, q]);

  const mockF = useMemo(() => {
    let r = MOCK.filter(c => {
      const h = `${c.year} ${c.make} ${c.model} ${c.trim} ${c.color} ${c.fuel} ${c.body} ${c.state} ${c.city}`.toLowerCase();
      return (!q.trim()||h.includes(q.toLowerCase()))&&(make==="All"||c.make===make)&&(body==="All"||c.body===body)
        &&(cond==="all"||c.cond===cond)&&(stateF==="All"||c.state===stateF)&&c.price<=maxP;
    });
    if(sort==="price_asc") r=[...r].sort((a,b)=>a.price-b.price);
    if(sort==="price_desc") r=[...r].sort((a,b)=>b.price-a.price);
    if(sort==="miles_asc") r=[...r].sort((a,b)=>(a.miles||0)-(b.miles||0));
    if(sort==="year_desc") r=[...r].sort((a,b)=>b.year-a.year);
    return r;
  }, [q,make,body,cond,stateF,maxP,sort]);

  const cars  = liveReady ? liveCars  : mockF;
  const total = liveReady ? liveTotal : mockF.length;
  const pages = Math.ceil(total / PER);

  const vp=car?.price??0, tax=Math.round(vp*TAX), otd=vp+tax, dn=Math.round(otd*downPct/100), mo=car?calcMo(otd,dn,termMo,apr):0;

  const submitLead = async () => {
    if (!car) return;
    setSubmitting(true);
    const lead = {
      id: uid(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      status: "New", name:form.name, phone:form.phone, email:form.email, notes:form.notes,
      car_year:car.year, car_make:car.make, car_model:car.model, car_trim:car.trim,
      car_price:car.price, car_miles:car.miles, car_vin:car.vin||"",
      dealer:car.dealer, city:car.city, state:car.state||"", cond:car.cond,
      fee:CONFIG.FLAT_FEE, log:"",
    };
    // Save locally for admin dashboard
    lsAdd(lead);
    // Also send to Netlify Forms — shows in your Netlify dashboard from any device
    try { await submitToNetlify(lead); } catch(e) { console.warn("Netlify Forms:", e); }
    setTimeout(() => {
      setSubmitting(false); setModal(false);
      setConfLead(lead); setForm({name:"",phone:"",email:"",notes:""}); go("confirm");
    }, 800);
  };

  const login = () => {
    if (passIn === CONFIG.ADMIN_PASSWORD) { setAuthed(true); setPassErr(false); setLeads(lsGet()); }
    else setPassErr(true);
  };

  const inp  = { width:"100%",padding:"12px 15px",borderRadius:10,border:`1px solid ${T.line}`,fontSize:15,fontFamily:"inherit",color:T.ink,background:T.card };
  const chip = on => ({ padding:mobile?"6px 11px":"7px 15px",borderRadius:980,border:`1.5px solid ${on?T.green:T.line}`,background:on?T.greenBg:"transparent",color:on?T.green:T.faint,fontSize:mobile?11:12.5,fontWeight:600,cursor:"pointer",flexShrink:0 });
  const gBtn = d  => ({ width:"100%",height:50,borderRadius:12,border:"none",fontSize:16,fontWeight:700,cursor:d?"default":"pointer",background:d?"#e5e5e5":T.green,color:d?"#aaa":"#fff",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8 });

  return (
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Text',system-ui,sans-serif",color:T.ink,WebkitFontSmoothing:"antialiased"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        @keyframes rise{from{opacity:0;transform:translateY(10px);}to{opacity:1;}}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes pop{0%{transform:scale(.78);opacity:0;}65%{transform:scale(1.05);}100%{transform:scale(1);opacity:1;}}
        @keyframes shimmer{0%{background-position:-600px 0;}100%{background-position:600px 0;}}
        .rise{animation:rise .32s cubic-bezier(.22,1,.36,1) both;} .pop{animation:pop .45s ease both;}
        input:focus,select:focus,textarea:focus{outline:none!important;border-color:${T.green}!important;box-shadow:0 0 0 3px ${T.greenBg}!important;}
        ::-webkit-scrollbar{width:4px;height:4px;}::-webkit-scrollbar-thumb{background:#d2d2d7;border-radius:4px;}
        .vc{transition:transform .2s,box-shadow .2s;cursor:pointer;}.vc:hover{transform:translateY(-3px);box-shadow:0 10px 28px rgba(0,0,0,.1)!important;}
        .skel{background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);background-size:600px;animation:shimmer 1.4s infinite;}
        input[type=range]{-webkit-appearance:none;appearance:none;height:4px;border-radius:4px;cursor:pointer;}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:${T.green};cursor:pointer;box-shadow:0 2px 6px rgba(0,182,122,.35);}
        .overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(8px);z-index:80;display:flex;align-items:flex-end;justify-content:center;}
        @media(min-width:600px){.overlay{align-items:center;padding:20px;}}
        .sheet{border-radius:22px 22px 0 0;max-height:88vh;overflow-y:auto;width:100%;}
        @media(min-width:600px){.sheet{border-radius:22px;max-width:480px;}}
        .rh:hover{background:#f8fafc;} textarea{font-family:inherit;resize:vertical;}
      `}</style>

      {/* NAV */}
      <nav style={{position:"sticky",top:0,zIndex:50,borderBottom:`1px solid ${T.line}`,background:"rgba(255,255,255,.88)",backdropFilter:"saturate(180%) blur(20px)",WebkitBackdropFilter:"saturate(180%) blur(20px)"}}>
        <div style={{maxWidth:1280,margin:"0 auto",padding:`0 ${mobile?16:24}px`,height:52,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <LOGO onClick={()=>{setQ("");setMake("All");setBody("All");setCond("all");setStateF("All");setLiveReady(false);go("home");}}/>
          <button onClick={()=>go("admin")} style={{background:"none",border:"none",color:T.faint,fontSize:12,cursor:"pointer",padding:0,fontWeight:500}}>Admin ↗</button>
        </div>
      </nav>

      {/* ══ HOME ══ */}
      {view==="home" && <>
        <section style={{background:T.dark,padding:mobile?"46px 16px 42px":"66px 24px 58px"}}>
          <div style={{maxWidth:780,margin:"0 auto",textAlign:"center"}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(0,182,122,.12)",border:"1px solid rgba(0,182,122,.2)",borderRadius:980,padding:"5px 14px",fontSize:11.5,fontWeight:700,color:"#00d48a",letterSpacing:".05em",marginBottom:20}}>
              🔑 LICENSED CONCIERGE · NO SPAM EVER
            </div>
            <h1 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:`clamp(28px,${mobile?9:6}vw,72px)`,fontWeight:800,letterSpacing:"-.04em",lineHeight:.94,color:"#fff",marginBottom:16}}>
              Search Every Dealer.<br/><span style={{color:T.green}}>Nationwide.</span>
            </h1>
            <p style={{fontSize:mobile?14:17,color:"rgba(255,255,255,.5)",lineHeight:1.6,maxWidth:460,margin:"0 auto 28px"}}>
              Browse real inventory from every state. Find your car, then let us handle the rest.
            </p>
            <div style={{display:"flex",background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.12)",borderRadius:14,overflow:"hidden"}}>
              <span style={{display:"flex",alignItems:"center",paddingLeft:16,color:"rgba(255,255,255,.3)",fontSize:17,flexShrink:0}}>⌕</span>
              <input value={q} onChange={e=>{setQ(e.target.value);setPage(1);}} placeholder="Make, model, color, type…"
                style={{flex:1,background:"transparent",border:"none",padding:"14px 12px",fontSize:mobile?15:16,color:"#fff",fontFamily:"inherit"}}/>
              <select value={stateF} onChange={e=>{setStateF(e.target.value);setPage(1);}}
                style={{background:"rgba(255,255,255,.1)",border:"none",borderLeft:"1px solid rgba(255,255,255,.1)",color:"rgba(255,255,255,.7)",padding:"0 14px",fontSize:13,fontFamily:"inherit",cursor:"pointer",flexShrink:0}}>
                {STATES.map(s=><option key={s} style={{background:"#1d1d1f"}}>{s}</option>)}
              </select>
            </div>
            {!liveReady && (
              <p style={{fontSize:11.5,color:"rgba(255,255,255,.25)",marginTop:14}}>
                Showing sample inventory · Add MARKETCHECK_KEY in Netlify to load live data
              </p>
            )}
          </div>
        </section>

        {/* Filter bar */}
        <div style={{position:"sticky",top:52,zIndex:40,background:"rgba(255,255,255,.94)",backdropFilter:"blur(12px)",borderBottom:`1px solid ${T.line}`}}>
          <div style={{maxWidth:1280,margin:"0 auto",padding:mobile?"8px 14px":"10px 24px",display:"flex",alignItems:"center",gap:8,overflowX:"auto"}}>
            {[["all","All"],["used","Used"],["new","New"],["certified","CPO"]].map(([v,l])=>(
              <button key={v} style={chip(cond===v)} onClick={()=>{setCond(v);setPage(1);}}>{l}</button>
            ))}
            <div style={{width:1,height:18,background:T.line,flexShrink:0,margin:"0 2px"}}/>
            {BODIES.map(b=><button key={b} style={chip(body===b)} onClick={()=>{setBody(b);setPage(1);}}>{b}</button>)}
            {!mobile && <>
              <div style={{width:1,height:18,background:T.line,flexShrink:0,margin:"0 2px"}}/>
              <select value={make} onChange={e=>{setMake(e.target.value);setPage(1);}} style={{...inp,width:"auto",padding:"7px 11px",borderRadius:980,fontSize:12.5,cursor:"pointer",flexShrink:0}}>
                {MAKES.map(m=><option key={m}>{m}</option>)}
              </select>
            </>}
            <select value={sort} onChange={e=>{setSort(e.target.value);setPage(1);}} style={{...inp,width:"auto",padding:"7px 11px",borderRadius:980,fontSize:mobile?12:12.5,cursor:"pointer",flexShrink:0,marginLeft:"auto"}}>
              <option value="default">Best match</option><option value="price_asc">Price ↑</option>
              <option value="price_desc">Price ↓</option><option value="miles_asc">Mileage ↑</option><option value="year_desc">Newest</option>
            </select>
          </div>
        </div>

        {/* Grid */}
        <div style={{maxWidth:1280,margin:"0 auto",padding:mobile?"16px 14px 80px":"24px 24px 80px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
            <p style={{fontSize:13,color:T.faint}}>
              {loading?"Loading live inventory…":apiErr?<span style={{color:"#ef4444"}}>{apiErr}</span>:<><strong style={{color:T.ink}}>{total.toLocaleString()}</strong> vehicles{liveReady?" · Live data":" · Sample data"} · {stateF==="All"?"Nationwide":stateF}</>}
            </p>
            {pages>1&&!loading&&(
              <div style={{display:"flex",alignItems:"center",gap:8,fontSize:13}}>
                <button disabled={page===1} onClick={()=>setPage(p=>p-1)} style={{background:"none",border:`1px solid ${T.line}`,borderRadius:8,padding:"5px 12px",cursor:page===1?"default":"pointer",color:page===1?T.line:T.ink,fontFamily:"inherit"}}>‹</button>
                <span style={{color:T.soft}}>{page} / {pages}</span>
                <button disabled={page>=pages} onClick={()=>setPage(p=>p+1)} style={{background:"none",border:`1px solid ${T.line}`,borderRadius:8,padding:"5px 12px",cursor:page>=pages?"default":"pointer",color:page>=pages?T.line:T.ink,fontFamily:"inherit"}}>›</button>
              </div>
            )}
          </div>
          {loading&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:18}}>
              {Array.from({length:8}).map((_,i)=>(
                <div key={i} style={{borderRadius:18,overflow:"hidden",border:`1px solid ${T.line}`}}>
                  <div className="skel" style={{height:165}}/><div style={{padding:14}}>
                  <div className="skel" style={{height:11,borderRadius:6,width:"40%",marginBottom:8}}/>
                  <div className="skel" style={{height:18,borderRadius:6,marginBottom:6}}/>
                  <div className="skel" style={{height:13,borderRadius:6,width:"65%"}}/></div>
                </div>
              ))}
            </div>
          )}
          {!loading&&cars.length>0&&(
            <div style={{display:"grid",gridTemplateColumns:mobile?"1fr 1fr":"repeat(auto-fill,minmax(260px,1fr))",gap:mobile?12:18}}>
              {cars.map(c=><CC key={c.id} c={c} mobile={mobile} T={T} onClick={()=>{setCar(c);setDownPct(10);setTermMo(60);setApr(6.9);go("vdp");}}/>)}
            </div>
          )}
          {!loading&&!apiErr&&cars.length===0&&(
            <div style={{textAlign:"center",padding:"80px 20px",color:T.faint}}>
              <div style={{fontSize:40,marginBottom:12}}>🔍</div>
              <div style={{fontSize:17,fontWeight:600,marginBottom:8}}>No matches</div>
              <p style={{fontSize:14}}>Try different filters or pick another state.</p>
            </div>
          )}
        </div>
      </>}

      {/* ══ VDP ══ */}
      {view==="vdp"&&car&&(
        <div className="rise" style={{maxWidth:1100,margin:"0 auto",padding:mobile?`16px 16px ${mobile?130:80}px`:"24px 24px 100px"}}>
          <button onClick={()=>go("home")} style={{background:"none",border:"none",color:T.green,fontSize:14,fontWeight:700,cursor:"pointer",padding:0,marginBottom:16,minHeight:44,display:"flex",alignItems:"center",gap:5}}>← Back</button>
          <div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"1fr 360px",gap:mobile?20:26,alignItems:"start"}}>
            <div>
              <div style={{height:mobile?210:380,borderRadius:20,overflow:"hidden",background:`linear-gradient(135deg,hsl(${car.id?.charCodeAt?.(1)*40%360||200},28%,84%),hsl(${car.id?.charCodeAt?.(1)*40%360||200},22%,72%))`,position:"relative",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:mobile?64:88}}>
                {car.photo?<img src={car.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover",position:"absolute",inset:0}}/>
                  :<span>{car.fuel==="Electric"?"⚡":car.body?.includes("Truck")||car.body?.includes("Pick")?"🛻":car.body==="Wagon"?"🚙":"🚗"}</span>}
                <div style={{position:"absolute",top:14,left:14,display:"flex",gap:8}}><BDGE cond={car.cond}/>{car.fuel==="Electric"&&<span style={{background:"rgba(0,182,122,.15)",color:"#007a52",fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:6}}>⚡</span>}</div>
                {car.dealer&&<div style={{position:"absolute",bottom:12,left:12,background:"rgba(255,255,255,.82)",backdropFilter:"blur(8px)",borderRadius:8,padding:"5px 11px",fontSize:11.5,fontWeight:500,color:T.ink}}>{car.dealer} · {car.city}{car.state?", "+car.state:""}</div>}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,gap:12}}>
                <div>
                  <div style={{fontSize:12.5,color:T.faint,marginBottom:3}}>{car.year} · {car.body} · {car.color}</div>
                  <h1 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:mobile?24:34,fontWeight:800,letterSpacing:"-.03em",color:T.ink,marginBottom:3,lineHeight:1.05}}>{car.make} {car.model}</h1>
                  <div style={{fontSize:mobile?14:16,color:T.soft}}>{car.trim}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:mobile?26:34,fontWeight:800,letterSpacing:"-.03em",color:T.ink,lineHeight:1}}>{$(car.price)}</div>
                  <div style={{fontSize:13,color:T.faint,marginTop:2}}>{mi(car.miles)}</div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:mobile?8:10,marginBottom:20}}>
                {[["Drive",car.drive||"—"],["Fuel",car.fuel||"—"],["Engine",(car.engine||"—").split(" ").slice(0,2).join(" ")],["MPG",car.fuel==="Electric"?"EV":car.mpg_city?car.mpg_city+" city":"—"]].map(([k,v])=>(
                  <div key={k} style={{background:T.card,border:`1px solid ${T.line}`,borderRadius:12,padding:mobile?"10px":"12px 13px"}}>
                    <div style={{fontSize:9.5,color:T.faint,fontWeight:600,textTransform:"uppercase",letterSpacing:".05em",marginBottom:3}}>{k}</div>
                    <div style={{fontSize:mobile?12:13,fontWeight:600,color:T.ink}}>{v}</div>
                  </div>
                ))}
              </div>
              {/* Payment calc */}
              <div style={{background:T.card,border:`1px solid ${T.line}`,borderRadius:20,padding:mobile?"18px 16px":"26px 24px"}}>
                <div style={{fontSize:11,fontWeight:700,color:T.faint,textTransform:"uppercase",letterSpacing:".08em",marginBottom:18}}>Payment Estimator</div>
                <div style={{display:mobile?"block":"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22,paddingBottom:18,borderBottom:`1px solid ${T.line}`,gap:16}}>
                  <div style={{marginBottom:mobile?14:0}}>
                    <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:mobile?40:50,fontWeight:800,letterSpacing:"-.04em",color:T.green,lineHeight:1}}>
                      {$(mo)}<span style={{fontSize:17,color:T.faint,fontWeight:400}}>/mo</span>
                    </div>
                    <div style={{fontSize:11.5,color:T.faint,marginTop:5}}>{$(mo*termMo)} total · {$(Math.max(0,mo*termMo-otd+dn))} est. interest</div>
                  </div>
                  <div style={{background:T.bg,borderRadius:12,padding:"12px 14px"}}>
                    <PR l="Vehicle price" v={$(vp)}/><PR l={`Taxes & fees (~${TAX*100}%)`} v={"+ "+$(tax)} dim/>
                    <div style={{height:1,background:T.line,margin:"7px 0"}}/><PR l="Est. out-the-door" v={$(otd)} bold/>
                    <PR l={`Down (${downPct}%)`} v={"− "+$(dn)} dim/>
                    <div style={{height:1,background:T.line,margin:"7px 0"}}/><PR l="Financed" v={$(otd-dn)} bold/>
                  </div>
                </div>
                <SR label="Down Payment" display={`${downPct}% · ${$(dn)}`} value={downPct} min={0} max={50} step={1} onChange={setDownPct} T={T}/>
                <SR label="Loan Term" display={`${termMo} months`} value={termMo} min={24} max={84} step={12} onChange={setTermMo} T={T}/>
                <SR label="APR" display={`${apr.toFixed(1)}%`} value={apr} min={1.9} max={24.9} step={0.1} onChange={setApr} T={T}/>
                <div style={{background:T.bg,border:`1px solid ${T.line}`,borderRadius:10,padding:"11px 13px",marginTop:4}}>
                  <p style={{fontSize:11,color:T.faint,lineHeight:1.65}}><strong style={{color:T.soft}}>Disclaimer:</strong> Estimates only — not a financing offer. Actual price, taxes, fees, and APR vary by location, credit, lender, and dealer.</p>
                </div>
              </div>
            </div>
            {!mobile&&<SIDE car={car} mo={mo} otd={otd} dn={dn} termMo={termMo} apr={apr} T={T} fee={CONFIG.FLAT_FEE} onCTA={()=>setModal(true)}/>}
          </div>
        </div>
      )}

      {/* Mobile sticky CTA */}
      {view==="vdp"&&car&&mobile&&(
        <div style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(255,255,255,.96)",backdropFilter:"saturate(180%) blur(16px)",borderTop:`1px solid ${T.line}`,padding:"12px 16px",paddingBottom:"max(12px,env(safe-area-inset-bottom))",zIndex:60}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}>
            <span style={{fontSize:13.5,fontWeight:700,color:T.ink}}>{car.make} {car.model}</span>
            <span style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:18,fontWeight:800,color:T.green}}>{$(mo)}<span style={{fontSize:12,color:T.faint,fontWeight:400}}>/mo</span></span>
          </div>
          <button onClick={()=>setModal(true)} style={{width:"100%",background:T.green,color:"#fff",border:"none",padding:"15px 0",borderRadius:12,fontSize:16,fontWeight:800,cursor:"pointer",fontFamily:"inherit",boxShadow:`0 4px 16px rgba(0,182,122,.28)`}}>
            Let Us Work For You ⚡
          </button>
        </div>
      )}

      {/* ══ CONFIRM ══ */}
      {view==="confirm"&&confLead&&(
        <div className="rise" style={{maxWidth:480,margin:"0 auto",padding:mobile?"48px 20px 80px":"60px 24px 80px",textAlign:"center"}}>
          <div className="pop" style={{width:76,height:76,borderRadius:"50%",background:"rgba(0,182,122,.1)",border:`2px solid ${T.green}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,margin:"0 auto 20px"}}>⚡</div>
          <h1 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:28,fontWeight:800,letterSpacing:"-.03em",color:T.ink,marginBottom:10}}>Request received.</h1>
          <p style={{fontSize:mobile?15:17,color:T.soft,lineHeight:1.55,maxWidth:380,margin:"0 auto 26px"}}>
            Your concierge will reach out to <strong style={{color:T.ink}}>{confLead.name.split(" ")[0]}</strong> within 2 hours. <strong>You won't be charged until your purchase is complete.</strong>
          </p>
          <div style={{background:T.card,border:`1px solid ${T.line}`,borderRadius:18,padding:22,textAlign:"left",marginBottom:18}}>
            <div style={{display:"flex",justifyContent:"space-between",borderBottom:`1px solid ${T.line}`,paddingBottom:12,marginBottom:12}}>
              <span style={{fontSize:12.5,color:T.faint}}>Confirmation</span>
              <span style={{fontSize:13,fontWeight:700,color:T.green,fontFamily:"monospace"}}>{confLead.id}</span>
            </div>
            {[["Vehicle",`${confLead.car_year} ${confLead.car_make} ${confLead.car_model}`],["Listed at",$(confLead.car_price)],["Dealer",`${confLead.dealer}${confLead.state?", "+confLead.state:""}`],["Fee",`${$(confLead.fee)} — due at purchase only`]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",fontSize:14}}>
                <span style={{color:T.faint}}>{k}</span><span style={{fontWeight:600}}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{background:"rgba(0,182,122,.06)",border:`1px solid ${T.greenBdr}`,borderRadius:12,padding:"13px 16px",fontSize:13,color:"#005c3d",marginBottom:24,textAlign:"left",lineHeight:1.6}}>
            <strong>No charge until you buy.</strong> The {$(CONFIG.FLAT_FEE)} fee is only due after we've secured your deal and you've approved it.
          </div>
          <button onClick={()=>{setCar(null);go("home");}} style={{background:"none",border:`1.5px solid ${T.line}`,color:T.ink,padding:"12px 28px",borderRadius:980,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>← Keep browsing</button>
        </div>
      )}

      {/* ══ ADMIN ══ */}
      {view==="admin"&&(
        <div style={{minHeight:"100vh",background:"#f8fafc"}}>
          <div style={{background:T.dark,height:52,display:"flex",alignItems:"center",justifyContent:"space-between",padding:`0 ${mobile?16:24}px`}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <LOGO dark onClick={()=>go("admin")}/>
              <span style={{background:"rgba(255,255,255,.08)",color:"#94a3b8",fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:5,letterSpacing:".06em"}}>ADMIN</span>
            </div>
            <div style={{display:"flex",gap:14,alignItems:"center"}}>
              {authed&&<button onClick={()=>{setAuthed(false);setPassIn("");setActiveL(null);}} style={{background:"none",border:"none",color:"#64748b",fontSize:13,cursor:"pointer"}}>Sign out</button>}
              <button onClick={()=>go("home")} style={{background:"none",border:"1px solid #1e293b",color:"#64748b",padding:"6px 14px",borderRadius:8,fontSize:12.5,cursor:"pointer",fontFamily:"inherit"}}>← Site</button>
            </div>
          </div>

          {!authed&&(
            <div className="rise" style={{maxWidth:380,margin:"80px auto",padding:"0 20px"}}>
              <div style={{background:T.card,borderRadius:20,padding:32,boxShadow:"0 4px 24px rgba(0,0,0,.07)"}}>
                <div style={{fontSize:22,fontWeight:700,marginBottom:6}}>Admin Login</div>
                <p style={{color:T.soft,fontSize:13.5,lineHeight:1.5,marginBottom:22}}>Sign in to view and manage leads.</p>
                <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,padding:"12px 14px",marginBottom:18,fontSize:13,color:"#92400e",lineHeight:1.5}}>
                  💡 <strong>Tip:</strong> All leads also appear in your Netlify dashboard under <strong>Forms → lead</strong> from any device — no login needed there.
                </div>
                <input type="password" placeholder="Password" value={passIn} onChange={e=>{setPassIn(e.target.value);setPassErr(false);}} onKeyDown={e=>e.key==="Enter"&&login()} style={{...inp,marginBottom:8,borderColor:passErr?"#ef4444":T.line}}/>
                {passErr&&<p style={{color:"#ef4444",fontSize:13,marginBottom:8}}>Incorrect password</p>}
                <button onClick={login} style={{...gBtn(false),marginTop:6}}>Sign in</button>
              </div>
            </div>
          )}

          {authed&&!activeL&&(
            <div className="rise" style={{maxWidth:1100,margin:"0 auto",padding:mobile?"20px 16px 60px":"28px 24px 60px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22,flexWrap:"wrap",gap:12}}>
                <div>
                  <h1 style={{fontSize:mobile?22:26,fontWeight:700,letterSpacing:"-.02em"}}>Lead Dashboard</h1>
                  <p style={{color:T.soft,fontSize:13.5,marginTop:3}}>{leads.length} leads on this device · <a href="https://app.netlify.com" target="_blank" rel="noreferrer" style={{color:T.green,fontWeight:600}}>See all in Netlify ↗</a></p>
                </div>
                <button onClick={()=>setLeads(lsGet())} style={{background:T.bg,border:`1px solid ${T.line}`,color:T.soft,padding:"9px 18px",borderRadius:10,fontSize:14,cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>↻ Refresh</button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:mobile?"repeat(3,1fr)":"repeat(5,1fr)",gap:mobile?10:12,marginBottom:24}}>
                {Object.entries(STATUS_META).map(([s,m])=>{
                  const n=leads.filter(l=>l.status===s).length;
                  return(
                    <div key={s} style={{background:T.card,border:`1px solid ${T.line}`,borderRadius:14,padding:mobile?"12px 11px":"16px 18px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}><span style={{width:7,height:7,borderRadius:"50%",background:m.dot,flexShrink:0}}/><span style={{fontSize:11,fontWeight:600,color:T.soft,textTransform:"capitalize"}}>{s}</span></div>
                      <div style={{fontSize:mobile?22:28,fontWeight:700,letterSpacing:"-.03em"}}>{n}</div>
                    </div>
                  );
                })}
              </div>
              {leads.length===0?(
                <div style={{background:T.card,border:`1px solid ${T.line}`,borderRadius:16,padding:"60px 24px",textAlign:"center"}}>
                  <div style={{fontSize:42,marginBottom:12}}>📋</div>
                  <div style={{fontSize:17,fontWeight:600,marginBottom:6}}>No leads yet</div>
                  <p style={{color:T.soft,fontSize:14,marginBottom:16}}>Submitted leads appear here and in your Netlify dashboard.</p>
                  <a href="https://app.netlify.com" target="_blank" rel="noreferrer" style={{color:T.green,fontWeight:600,fontSize:14}}>Open Netlify dashboard ↗</a>
                </div>
              ):(
                <div style={{background:T.card,border:`1px solid ${T.line}`,borderRadius:16,overflow:"hidden"}}>
                  {!mobile&&<div style={{display:"grid",gridTemplateColumns:"150px 1fr 1fr 90px 80px 90px",padding:"10px 20px",background:"#f8fafc",borderBottom:`1px solid ${T.line}`,fontSize:11,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:".06em"}}>
                    {["Client","Vehicle","Dealer","Fee","Status","Date"].map(h=><span key={h}>{h}</span>)}
                  </div>}
                  {leads.map(l=>{
                    const m=STATUS_META[l.status]||STATUS_META.New;
                    return mobile?(
                      <div key={l.id} className="rh" onClick={()=>{setActiveL(l);setSNote("");}} style={{padding:"14px 16px",borderBottom:`1px solid ${T.line}`,cursor:"pointer"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:5}}>
                          <div><div style={{fontWeight:700,fontSize:15}}>{l.name}</div><div style={{fontSize:12.5,color:T.soft}}>{l.car_year} {l.car_make} {l.car_model}</div></div>
                          <span style={{background:m.bg,color:m.text,fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,textTransform:"capitalize",whiteSpace:"nowrap"}}>{l.status}</span>
                        </div>
                        <div style={{fontSize:12,color:T.faint}}>{l.dealer}{l.state?", "+l.state:""} · {new Date(l.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>
                      </div>
                    ):(
                      <div key={l.id} className="rh" onClick={()=>{setActiveL(l);setSNote("");}} style={{display:"grid",gridTemplateColumns:"150px 1fr 1fr 90px 80px 90px",padding:"13px 20px",borderBottom:`1px solid ${T.line}`,cursor:"pointer",alignItems:"center"}}>
                        <div><div style={{fontWeight:600,fontSize:14}}>{l.name}</div><div style={{fontSize:12,color:T.soft}}>{l.phone}</div></div>
                        <div><div style={{fontSize:13.5,fontWeight:500}}>{l.car_year} {l.car_make} {l.car_model}</div><div style={{fontSize:12,color:T.soft}}>{$(l.car_price)}</div></div>
                        <div style={{fontSize:13,color:T.soft}}>{l.dealer}<br/><span style={{fontSize:11,color:T.faint}}>{l.city}{l.state?", "+l.state:""}</span></div>
                        <div style={{fontSize:13,fontWeight:700,color:T.green}}>{$(l.fee)}</div>
                        <div><span style={{background:m.bg,color:m.text,fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,textTransform:"capitalize"}}>{l.status}</span></div>
                        <div style={{fontSize:11.5,color:T.faint}}>{new Date(l.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {authed&&activeL&&(
            <div className="rise" style={{maxWidth:820,margin:"0 auto",padding:mobile?"20px 16px 60px":"28px 24px 60px"}}>
              <button onClick={()=>setActiveL(null)} style={{background:"none",border:"none",color:T.green,fontSize:14,fontWeight:700,cursor:"pointer",marginBottom:22,padding:0,minHeight:44,display:"flex",alignItems:"center",gap:5}}>← All leads</button>
              <div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"1fr 1fr",gap:16}}>
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  <PNL T={T} title="Client">
                    <div style={{fontSize:mobile?20:22,fontWeight:700,marginBottom:4}}>{activeL.name}</div>
                    <div style={{fontSize:15,color:T.soft,marginBottom:2}}>{activeL.email}</div>
                    <div style={{fontSize:15,color:T.soft,marginBottom:14}}>{activeL.phone}</div>
                    <KV T={T} k="Submitted" v={new Date(activeL.created_at).toLocaleString()}/>
                    <KV T={T} k="Fee" v={`${$(activeL.fee)} — due at purchase`}/>
                    <KV T={T} k="ID" v={activeL.id} mono/>
                  </PNL>
                  <PNL T={T} title="Vehicle">
                    <div style={{fontSize:18,fontWeight:700,marginBottom:2}}>{activeL.car_year} {activeL.car_make} {activeL.car_model}</div>
                    <div style={{fontSize:13.5,color:T.soft,marginBottom:12}}>{activeL.car_trim}</div>
                    <KV T={T} k="Price" v={$(activeL.car_price)}/><KV T={T} k="Mileage" v={mi(activeL.car_miles)}/><KV T={T} k="Condition" v={activeL.cond}/><KV T={T} k="Dealer" v={activeL.dealer}/><KV T={T} k="Location" v={`${activeL.city||""}${activeL.state?", "+activeL.state:""}`}/>
                    {activeL.car_vin&&<KV T={T} k="VIN" v={activeL.car_vin} mono/>}
                  </PNL>
                  {activeL.notes&&<PNL T={T} title="Customer Notes"><p style={{fontSize:13.5,color:T.soft,lineHeight:1.6}}>{activeL.notes}</p></PNL>}
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  <PNL T={T} title="Update Status">
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
                      {Object.entries(STATUS_META).map(([s,m])=>(
                        <button key={s} onClick={()=>{
                          const log=(activeL.log||"")+(sNote.trim()?`\n[${new Date().toLocaleDateString()}] → ${s}: ${sNote.trim()}`:`\n[${new Date().toLocaleDateString()}] → ${s}`);
                          const fresh=lsPatch(activeL.id,{status:s,log});
                          setLeads(fresh);setActiveL(fresh.find(l=>l.id===activeL.id));setSNote("");
                        }} style={{padding:"9px 8px",borderRadius:10,border:`2px solid ${activeL.status===s?m.dot:T.line}`,background:activeL.status===s?m.bg:T.card,color:activeL.status===s?m.text:T.soft,fontSize:13,fontWeight:600,cursor:"pointer",textTransform:"capitalize"}}>{s}</button>
                      ))}
                    </div>
                    <textarea value={sNote} onChange={e=>setSNote(e.target.value)} placeholder="Optional note…" style={{...inp,height:72,fontSize:13}}/>
                  </PNL>
                  <PNL T={T} title="Activity Log">
                    {activeL.log?.trim()?<pre style={{fontSize:12.5,color:T.soft,lineHeight:1.7,whiteSpace:"pre-wrap",fontFamily:"inherit"}}>{activeL.log.trim()}</pre>:<p style={{fontSize:13.5,color:T.faint}}>No activity yet.</p>}
                  </PNL>
                  <div style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:14,padding:16}}>
                    <div style={{fontSize:13,fontWeight:600,color:"#0369a1",marginBottom:10}}>Quick contact</div>
                    <a href={`tel:${activeL.phone}`} style={{display:"flex",alignItems:"center",gap:8,padding:"11px 14px",background:T.card,borderRadius:10,fontSize:14,color:T.green,textDecoration:"none",fontWeight:600,marginBottom:8}}>📞 Call {activeL.name.split(" ")[0]}</a>
                    <a href={`mailto:${activeL.email}?subject=Your DEALRHCKR Request — ${activeL.car_year} ${activeL.car_make} ${activeL.car_model}`} style={{display:"flex",alignItems:"center",gap:8,padding:"11px 14px",background:T.card,borderRadius:10,fontSize:14,color:T.green,textDecoration:"none",fontWeight:600}}>✉️ Email {activeL.name.split(" ")[0]}</a>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ MODAL ══ */}
      {modal&&car&&(
        <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)setModal(false);}}>
          <div className="sheet rise" style={{background:T.card,boxShadow:"0 -8px 40px rgba(0,0,0,.14)"}}>
            {mobile&&<div style={{width:40,height:4,borderRadius:2,background:T.line,margin:"12px auto 0"}}/>}
            <div style={{background:`linear-gradient(135deg,${T.greenBg},rgba(0,182,122,.14))`,padding:"22px 22px 18px",borderBottom:`1px solid ${T.greenBdr}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{flex:1,paddingRight:12}}>
                  <div style={{fontSize:11,color:T.green,fontWeight:800,letterSpacing:".1em",marginBottom:5}}>CONCIERGE SERVICE</div>
                  <h2 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:22,fontWeight:800,color:T.ink,letterSpacing:"-.02em",marginBottom:6}}>Let Us Work For You</h2>
                  <p style={{fontSize:13.5,color:T.soft,lineHeight:1.5,marginBottom:14}}>We negotiate with the dealer, handle all paperwork, and coordinate delivery. You just approve the deal.</p>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                    <span style={{background:T.greenBg,border:`1px solid ${T.greenBdr}`,color:T.green,fontSize:13,fontWeight:700,padding:"6px 14px",borderRadius:980}}>Flat fee: {$(CONFIG.FLAT_FEE)}</span>
                    <span style={{background:"rgba(0,0,0,.04)",color:T.soft,fontSize:12.5,fontWeight:600,padding:"6px 14px",borderRadius:980}}>🔒 No charge until you buy</span>
                  </div>
                </div>
                <button onClick={()=>setModal(false)} style={{background:T.bg,border:"none",color:T.faint,width:34,height:34,borderRadius:"50%",cursor:"pointer",fontSize:18,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
              </div>
            </div>
            <div style={{padding:"16px 22px 0"}}><div style={{background:T.bg,borderRadius:10,padding:"11px 14px",fontSize:13,color:T.soft,lineHeight:1.5}}><strong style={{color:T.ink}}>{car.year} {car.make} {car.model}</strong>{car.trim?` · ${car.trim}`:""}<br/>{$(car.price)} · {car.dealer}{car.state?", "+car.state:""}</div></div>
            <div style={{padding:"16px 22px 24px"}}>
              {[["name","Your name","text"],["phone","Phone number","tel"],["email","Email address","email"]].map(([k,ph,tp])=>(
                <div key={k} style={{marginBottom:11}}>
                  <label style={{fontSize:11,fontWeight:700,color:T.faint,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:5}}>{ph}</label>
                  <input type={tp} placeholder={ph} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} style={{...inp,fontSize:16}}/>
                </div>
              ))}
              <div style={{marginBottom:16}}>
                <label style={{fontSize:11,fontWeight:700,color:T.faint,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:5}}>Notes (optional)</label>
                <textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Target price, trade-in, max budget…" style={{...inp,height:72,fontSize:14}}/>
              </div>
              <button disabled={!form.name||!form.phone||!form.email||submitting} onClick={submitLead} style={gBtn(!form.name||!form.phone||!form.email||submitting)}>
                {submitting?<><SP/>Submitting…</>:"Submit Request ⚡"}
              </button>
              <p style={{textAlign:"center",fontSize:12,color:T.faint,marginTop:10,lineHeight:1.5}}>Your info is never shared without your approval.<br/><strong>{$(CONFIG.FLAT_FEE)} fee is only due when your purchase is finalized.</strong></p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Components ───────────────────────────────────────────────────────────────
function SIDE({car,mo,otd,dn,termMo,apr,T,fee,onCTA}){
  return(
    <div style={{position:"sticky",top:72,background:T.card,border:`1px solid ${T.line}`,borderRadius:20,overflow:"hidden",boxShadow:"0 4px 24px rgba(0,0,0,.06)"}}>
      <div style={{padding:"24px 22px 18px",borderBottom:`1px solid ${T.line}`}}>
        <div style={{fontSize:11,color:T.faint,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>{car.cond==="new"?"MSRP":"Asking Price"}</div>
        <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:38,fontWeight:800,letterSpacing:"-.03em",color:T.ink,lineHeight:1,marginBottom:4}}>{$(car.price)}</div>
        <div style={{fontSize:13,color:T.faint}}>{car.miles?car.miles.toLocaleString()+" mi":"New"} · {car.color||"—"}</div>
        <div style={{marginTop:14,background:"rgba(0,182,122,.06)",border:`1px solid ${T.greenBdr}`,borderRadius:10,padding:"10px 14px"}}>
          <div style={{fontSize:13,color:T.green,fontWeight:700}}>Est. {$(mo)}/mo</div>
          <div style={{fontSize:11,color:T.faint,marginTop:2}}>{$(otd)} est. OTD · {termMo}mo · {apr}% APR</div>
        </div>
      </div>
      <div style={{padding:"18px 22px 22px"}}>
        <button onClick={onCTA} style={{width:"100%",background:T.green,color:"#fff",border:"none",padding:"16px 18px",borderRadius:12,fontSize:16,fontWeight:800,cursor:"pointer",fontFamily:"inherit",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:`0 4px 14px rgba(0,182,122,.28)`,marginBottom:14}}>
          <div><div>Let Us Work For You</div><div style={{fontSize:12,fontWeight:500,opacity:.85,marginTop:2}}>Flat fee · No charge until you buy</div></div>
          <span style={{fontSize:22}}>⚡</span>
        </button>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
          {[["🔒","No Spam","Info stays private"],["💰","No Risk","Pay only at purchase"]].map(([icon,title,sub])=>(
            <div key={title} style={{background:T.bg,borderRadius:10,padding:"11px 10px",textAlign:"center"}}>
              <div style={{fontSize:18}}>{icon}</div>
              <div style={{fontSize:11.5,fontWeight:700,color:T.ink,marginTop:3}}>{title}</div>
              <div style={{fontSize:10,color:T.faint,marginTop:1,lineHeight:1.4}}>{sub}</div>
            </div>
          ))}
        </div>
        <div style={{fontSize:12.5,color:T.faint,lineHeight:1.8,borderTop:`1px solid ${T.line}`,paddingTop:12}}>
          <strong style={{color:T.soft}}>Dealer:</strong> {car.dealer||"—"}<br/>
          <strong style={{color:T.soft}}>Location:</strong> {car.city}{car.state?", "+car.state:""}
        </div>
      </div>
    </div>
  );
}
function CC({c,mobile,T,onClick}){
  const e=c.fuel==="Electric"?"⚡":c.body?.includes("Truck")||c.body?.includes("Pick")?"🛻":c.body==="Wagon"?"🚙":"🚗";
  const hue = c.id?.charCodeAt?.(1)*40%360||200;
  return(
    <div className="vc" onClick={onClick} style={{borderRadius:18,overflow:"hidden",background:T.card,border:`1px solid ${T.line}`,boxShadow:"0 1px 4px rgba(0,0,0,.04)"}}>
      <div style={{height:mobile?138:165,background:`linear-gradient(135deg,hsl(${hue},28%,88%),hsl(${hue},22%,74%))`,position:"relative",display:"flex",alignItems:"center",justifyContent:"center",fontSize:mobile?44:52,overflow:"hidden"}}>
        {c.photo?<img src={c.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover",position:"absolute",inset:0}}/>:<span>{e}</span>}
        <div style={{position:"absolute",top:10,left:10,display:"flex",gap:5}}><BDGE cond={c.cond}/>{c.fuel==="Electric"&&<span style={{background:"rgba(0,182,122,.15)",color:"#007a52",fontSize:10,fontWeight:700,padding:"3px 7px",borderRadius:5}}>⚡</span>}</div>
        {c.state&&<span style={{position:"absolute",top:10,right:10,background:"rgba(0,0,0,.3)",color:"#fff",fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:5}}>{c.state}</span>}
      </div>
      <div style={{padding:mobile?"10px 12px 13px":"13px 15px 16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:mobile?10:12,color:T.faint,marginBottom:2}}><span>{c.year} · {c.city||c.state}</span><span>{mi(c.miles)}</span></div>
        <div style={{fontSize:mobile?14.5:17,fontWeight:700,color:T.ink,letterSpacing:"-.01em",marginBottom:1}}>{c.make} {c.model}</div>
        <div style={{fontSize:mobile?11:13,color:T.soft,marginBottom:mobile?9:11}}>{c.trim}</div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:9,borderTop:`1px solid ${T.line}`}}>
          <span style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:mobile?16.5:19.5,fontWeight:800,color:T.ink,letterSpacing:"-.02em"}}>{$(c.price)}</span>
          <span style={{fontSize:11.5,fontWeight:700,color:"#fff",background:T.green,padding:"4px 10px",borderRadius:7}}>View →</span>
        </div>
      </div>
    </div>
  );
}
function LOGO({onClick,dark}){return <div onClick={onClick} style={{cursor:"pointer",fontFamily:"'Space Grotesk',sans-serif",fontSize:20,fontWeight:800,letterSpacing:"-.03em",lineHeight:1}}><span style={{color:dark?"#94a3b8":"#1d1d1f"}}>DEAL</span><span style={{color:"#00b67a"}}>RHCKR</span></div>;}
function BDGE({cond}){const m={new:["#00b67a","rgba(0,182,122,.12)","NEW"],certified:["#0071e3","rgba(0,113,227,.12)","CPO"],used:["#6e6e73","rgba(110,110,115,.1)","USED"]};const[col,bg,label]=m[cond]||m.used;return <span style={{background:bg,color:col,fontSize:10.5,fontWeight:700,padding:"3px 9px",borderRadius:6,letterSpacing:".04em"}}>{label}</span>;}
function PNL({T,title,children}){return <div style={{background:"#fff",border:`1px solid ${T.line}`,borderRadius:16,padding:20}}><div style={{fontSize:10.5,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:".07em",marginBottom:13}}>{title}</div>{children}</div>;}
function KV({T,k,v,mono}){return <div style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #f8fafc",fontSize:13.5}}><span style={{color:T.faint,flexShrink:0}}>{k}</span><span style={{fontWeight:500,fontFamily:mono?"monospace":"inherit",fontSize:mono?11:13.5,wordBreak:"break-all",textAlign:"right",maxWidth:"60%",textTransform:"capitalize"}}>{v||"—"}</span></div>;}
function SR({label,display,value,min,max,step,onChange,T}){const pct=((value-min)/(max-min))*100;return <div style={{marginBottom:20}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:9}}><span style={{fontSize:12.5,color:T.faint,fontWeight:600}}>{label}</span><span style={{fontSize:13.5,fontWeight:700,color:T.green}}>{display}</span></div><input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))} style={{width:"100%",accentColor:T.green,background:`linear-gradient(to right,${T.green} ${pct}%,#e5e5e7 ${pct}%)`}}/></div>;}
function PR({l,v,dim,bold}){return <div style={{display:"flex",justifyContent:"space-between",gap:12,marginBottom:4}}><span style={{fontSize:11.5,color:dim?"#86868b":"#6e6e73",whiteSpace:"nowrap"}}>{l}</span><span style={{fontSize:11.5,fontWeight:bold?700:500,color:bold?"#1d1d1f":"#6e6e73",whiteSpace:"nowrap"}}>{v}</span></div>;}
function SP(){return <span style={{width:15,height:15,border:"2px solid rgba(255,255,255,.4)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .7s linear infinite",display:"inline-block",flexShrink:0}}/>;}
