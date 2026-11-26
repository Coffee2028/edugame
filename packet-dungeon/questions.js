'use strict';

/* ===========================================================
   Packet Dungeon – generátor otázek
   Většina otázek se generuje náhodně, takže se neopakují
   pořád stejné a hráč se musí naučit princip, ne odpovědi.
   =========================================================== */

const CATEGORIES = {
  bin:   { name: 'Binární soustava',   color: '#4ade80' },
  mask:  { name: 'Masky a CIDR',       color: '#60a5fa' },
  ports: { name: 'Protokoly a porty',  color: '#f472b6' },
  osi:   { name: 'Model OSI',          color: '#facc15' },
  ip:    { name: 'IP adresy',          color: '#c084fc' },
};

const rnd = n => Math.floor(Math.random() * n);
const pick = arr => arr[rnd(arr.length)];

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* Sestaví otázku: správná odpověď + až 3 různé špatné. */
function makeQuestion(cat, text, correct, candidates, explain) {
  const options = [String(correct)];
  for (const c of shuffle(candidates.map(String))) {
    if (options.length >= 4) break;
    if (!options.includes(c)) options.push(c);
  }
  return { cat, text, correct: String(correct), options: shuffle(options), explain };
}

/* ---------- pomocné funkce ---------- */
const toBin8 = n => n.toString(2).padStart(8, '0');

function bitSum(n) {
  const parts = [];
  for (let b = 7; b >= 0; b--) if (n & (1 << b)) parts.push(1 << b);
  return parts.length ? parts.join(' + ') : '0';
}

function cidrToMask(p) {
  const octets = [];
  for (let i = 0; i < 4; i++) {
    const bits = Math.max(0, Math.min(8, p - i * 8));
    octets.push(bits ? 256 - (1 << (8 - bits)) : 0);
  }
  return octets.join('.');
}

const octet = () => rnd(256);
const hostOctet = () => 1 + rnd(254);

/* ---------- datové banky ---------- */
const PORTS = [
  ['HTTP', 80, 'nešifrovaný web'],
  ['HTTPS', 443, 'šifrovaný web (TLS)'],
  ['SSH', 22, 'zabezpečený vzdálený terminál'],
  ['FTP', 21, 'přenos souborů'],
  ['Telnet', 23, 'nešifrovaný vzdálený terminál'],
  ['SMTP', 25, 'odesílání e-mailů'],
  ['DNS', 53, 'překlad doménových jmen na IP'],
  ['POP3', 110, 'stahování e-mailů'],
  ['IMAP', 143, 'práce s e-maily na serveru'],
  ['RDP', 3389, 'vzdálená plocha Windows'],
  ['DHCP', 67, 'automatické přidělování IP adres'],
  ['NTP', 123, 'synchronizace času'],
  ['SNMP', 161, 'správa síťových zařízení'],
];

const LAYERS = ['1 Fyzická', '2 Linková', '3 Síťová', '4 Transportní', '5 Relační', '6 Prezentační', '7 Aplikační'];

const OSI_ITEMS = [
  ['router', 3, 'Router směruje pakety podle IP adres → síťová vrstva.'],
  ['switch', 2, 'Switch přepíná rámce podle MAC adres → linková vrstva.'],
  ['hub', 1, 'Hub jen opakuje elektrický signál do všech portů → fyzická vrstva.'],
  ['UTP kabel', 1, 'Kabel přenáší jen signál (bity) → fyzická vrstva.'],
  ['protokol TCP', 4, 'TCP řídí spojení a doručení segmentů → transportní vrstva.'],
  ['protokol UDP', 4, 'UDP posílá datagramy bez potvrzování → transportní vrstva.'],
  ['protokol IP', 3, 'IP adresuje a směruje pakety → síťová vrstva.'],
  ['protokol ICMP (ping)', 3, 'ICMP je pomocný protokol IP → síťová vrstva.'],
  ['protokol HTTP', 7, 'HTTP používají přímo aplikace (prohlížeč) → aplikační vrstva.'],
  ['protokol DNS', 7, 'DNS je služba pro aplikace → aplikační vrstva.'],
  ['MAC adresa', 2, 'MAC adresa je fyzická adresa síťové karty → linková vrstva.'],
];

const PDUS = [
  [1, 'bit'], [2, 'rámec'], [3, 'paket'], [4, 'segment'],
];

/* ---------- pevné otázky (fakta k zapamatování) ---------- */
const FIXED = [
  { cat: 'ports', level: 1, text: 'Který příkaz ověří dostupnost počítače pomocí ICMP?',
    correct: 'ping', wrong: ['ipconfig', 'nslookup', 'netstat'],
    explain: 'ping posílá ICMP Echo Request a čeká na Echo Reply.' },
  { cat: 'ports', level: 1, text: 'Který příkaz ve Windows vypíše IP adresu počítače?',
    correct: 'ipconfig', wrong: ['ping', 'tracert', 'hostname'],
    explain: 'ipconfig (v Linuxu ip a) vypíše IP adresu, masku a bránu.' },
  { cat: 'ports', level: 2, text: 'Který protokol potvrzuje doručení dat?',
    correct: 'TCP', wrong: ['UDP', 'IP', 'ICMP'],
    explain: 'TCP navazuje spojení (3-way handshake) a potvrzuje přijaté segmenty. UDP ne.' },
  { cat: 'ports', level: 2, text: 'Který protokol se hodí na videohovory a hry (rychlost > spolehlivost)?',
    correct: 'UDP', wrong: ['TCP', 'FTP', 'SMTP'],
    explain: 'UDP nečeká na potvrzení, takže má menší zpoždění – ztracený snímek nevadí.' },
  { cat: 'ports', level: 2, text: 'Který protokol překládá IP adresu na MAC adresu?',
    correct: 'ARP', wrong: ['DNS', 'DHCP', 'NAT'],
    explain: 'ARP zjistí MAC adresu k IP adrese v místní síti. DNS překládá jména na IP.' },
  { cat: 'ports', level: 3, text: 'Jak začíná TCP spojení (3-way handshake)?',
    correct: 'SYN → SYN-ACK → ACK', wrong: ['ACK → SYN → FIN', 'SYN → ACK → FIN', 'HELLO → OK → GO'],
    explain: 'Klient pošle SYN, server odpoví SYN-ACK, klient potvrdí ACK.' },
  { cat: 'osi', level: 1, text: 'Kolik vrstev má model OSI?',
    correct: '7', wrong: ['4', '5', '8'],
    explain: 'OSI má 7 vrstev: fyzická, linková, síťová, transportní, relační, prezentační, aplikační.' },
  { cat: 'osi', level: 2, text: 'Kolik vrstev má model TCP/IP?',
    correct: '4', wrong: ['7', '5', '3'],
    explain: 'TCP/IP: síťové rozhraní, internetová, transportní a aplikační vrstva.' },
  { cat: 'ip', level: 1, text: 'Co je adresa 127.0.0.1?',
    correct: 'loopback (tento PC)', wrong: ['výchozí brána', 'broadcast', 'DNS server Googlu'],
    explain: '127.0.0.1 (localhost) vždy ukazuje na vlastní počítač.' },
  { cat: 'ip', level: 2, text: 'PC dostal adresu 169.254.x.x. Co to znamená?',
    correct: 'nedostal IP z DHCP', wrong: ['má statickou IP', 'je to loopback', 'je v síti 10.0.0.0/8'],
    explain: '169.254.0.0/16 je APIPA – Windows si ji přidělí, když neodpoví DHCP server.' },
  { cat: 'ip', level: 1, text: 'Kolik bitů má IPv4 adresa?',
    correct: '32', wrong: ['64', '128', '48'],
    explain: 'IPv4 = 4 oktety × 8 bitů = 32 bitů.' },
  { cat: 'ip', level: 2, text: 'Kolik bitů má IPv6 adresa?',
    correct: '128', wrong: ['32', '64', '256'],
    explain: 'IPv6 má 128 bitů, zapisuje se jako 8 skupin hexadecimálních čísel.' },
  { cat: 'ip', level: 2, text: 'Kolik bitů má MAC adresa?',
    correct: '48', wrong: ['32', '64', '128'],
    explain: 'MAC adresa = 6 bajtů = 48 bitů, např. 3C:52:82:1A:2B:3C.' },
  { cat: 'ip', level: 3, text: 'Co dělá NAT na domácím routeru?',
    correct: 'překládá privátní IP na veřejnou', wrong: ['přiděluje IP adresy', 'překládá jména na IP', 'šifruje provoz'],
    explain: 'NAT umožní mnoha zařízením s privátní IP sdílet jednu veřejnou adresu.' },
];

/* ---------- generátory otázek ---------- */
const GENERATORS = [
  // ===== Binární soustava =====
  { cat: 'bin', level: 1, make() {
    const n = 16 + rnd(240);
    const b = toBin8(n);
    const reversed = parseInt(b.split('').reverse().join(''), 2);
    const c = [n + 1, n - 1, n ^ (1 << rnd(8)), n ^ (1 << rnd(8)), reversed, n + 16, n - 16]
      .filter(v => v >= 0 && v <= 255 && v !== n);
    return makeQuestion('bin', `Převeď binární číslo ${b} do desítkové soustavy.`, n, c,
      `${b} = ${bitSum(n)} = ${n}`);
  } },
  { cat: 'bin', level: 1, make() {
    const n = 16 + rnd(240);
    const c = [];
    for (let i = 0; i < 8; i++) c.push(toBin8(n ^ (1 << i)));
    return makeQuestion('bin', `Jak se zapíše číslo ${n} binárně (8 bitů)?`, toBin8(n), c,
      `${n} = ${bitSum(n)} → ${toBin8(n)}`);
  } },
  { cat: 'bin', level: 2, make() {
    const n = 16 + rnd(240);
    const hex = n.toString(16).toUpperCase().padStart(2, '0');
    const swapped = parseInt(hex[1] + hex[0], 16);
    const c = [n + 1, n - 1, n + 16, n - 16, swapped, n + 10].filter(v => v >= 0 && v <= 255 && v !== n);
    return makeQuestion('bin', `Kolik je hexadecimální 0x${hex} v desítkové soustavě?`, n, c,
      `0x${hex} = ${parseInt(hex[0], 16)}·16 + ${parseInt(hex[1], 16)} = ${n}`);
  } },
  { cat: 'bin', level: 2, make() {
    const bits = pick([1, 2, 3, 4, 5, 6, 7, 8]);
    const n = 2 ** bits;
    const c = [n - 1, n * 2, bits * 2, n / 2, n + 2].filter(v => v > 0 && v !== n);
    return makeQuestion('bin', `Kolik různých hodnot lze zapsat pomocí ${bits} bitů?`, n, c,
      `${bits} bitů → 2^${bits} = ${n} kombinací (0 až ${n - 1}).`);
  } },

  // ===== Masky a CIDR =====
  { cat: 'mask', level: 1, make() {
    const p = pick([8, 16, 24]);
    const c = [8, 16, 24, 32].filter(x => x !== p).map(cidrToMask).concat(['255.0.255.0']);
    return makeQuestion('mask', `Jaká maska odpovídá prefixu /${p}?`, cidrToMask(p), c,
      `/${p} = ${p} jedniček zleva = ${p / 8}× oktet 255 → ${cidrToMask(p)}`);
  } },
  { cat: 'mask', level: 2, make() {
    const p = 17 + rnd(14); // 17–30
    const c = [p - 1, p + 1, p - 2, p + 2, p - 8].filter(x => x >= 8 && x <= 30).map(cidrToMask);
    return makeQuestion('mask', `Jaká maska odpovídá prefixu /${p}?`, cidrToMask(p), c,
      `/${p} = ${p} jedniček zleva → ${cidrToMask(p)}`);
  } },
  { cat: 'mask', level: 2, make() {
    const p = 17 + rnd(14);
    const c = [p - 1, p + 1, p - 2, p + 2, p + 8].filter(x => x >= 8 && x <= 32).map(x => '/' + x);
    return makeQuestion('mask', `Maska ${cidrToMask(p)} se zapíše jako prefix…`, '/' + p, c,
      `Spočítej jedničky v masce: ${cidrToMask(p)} = ${p} jedniček → /${p}`);
  } },
  { cat: 'mask', level: 2, make() {
    const p = 22 + rnd(9); // 22–30
    const total = 2 ** (32 - p);
    const c = [total, total - 1, total * 2 - 2, total / 2 - 2, total + 2].filter(v => v > 0 && v !== total - 2);
    return makeQuestion('mask', `Kolik použitelných adres pro počítače má síť /${p}?`, total - 2, c,
      `/${p} → ${32 - p} bitů pro hosty → 2^${32 - p} = ${total} adres, minus adresa sítě a broadcast = ${total - 2}.`);
  } },
  { cat: 'mask', level: 3, make() {
    const p = 25 + rnd(5); // 25–29
    const block = 2 ** (32 - p);
    const last = hostOctet();
    const net = last - (last % block);
    const bc = net + block - 1;
    const pre = `192.168.${octet()}.`;
    const c = [last, bc, net + block, net - block, 0].filter(v => v >= 0 && v <= 255).map(v => pre + v);
    return makeQuestion('mask', `Jaká je adresa sítě pro ${pre}${last}/${p}?`, pre + net, c,
      `/${p} → bloky po ${block} adresách. ${last} leží v bloku ${net}–${bc}, adresa sítě je ${pre}${net}.`);
  } },
  { cat: 'mask', level: 3, make() {
    const p = 25 + rnd(5);
    const block = 2 ** (32 - p);
    const last = hostOctet();
    const net = last - (last % block);
    const bc = net + block - 1;
    const pre = `10.${octet()}.${octet()}.`;
    const c = [net, 255, bc - 1, bc + block, bc - block].filter(v => v >= 0 && v <= 255 && v !== bc).map(v => pre + v);
    return makeQuestion('mask', `Jaká je broadcastová adresa pro ${pre}${last}/${p}?`, pre + bc, c,
      `/${p} → bloky po ${block}. ${last} leží v bloku ${net}–${bc}, broadcast je poslední adresa: ${pre}${bc}.`);
  } },

  // ===== Protokoly a porty =====
  { cat: 'ports', level: 1, make() {
    const [name, port, desc] = pick(PORTS);
    const c = PORTS.filter(p => p[1] !== port).map(p => p[1]);
    return makeQuestion('ports', `Na kterém portu standardně běží ${name}?`, port, c,
      `${name} (${desc}) používá port ${port}.`);
  } },
  { cat: 'ports', level: 2, make() {
    const [name, port, desc] = pick(PORTS);
    const c = PORTS.filter(p => p[0] !== name).map(p => p[0]);
    return makeQuestion('ports', `Který protokol standardně používá port ${port}?`, name, c,
      `Port ${port} = ${name} (${desc}).`);
  } },

  // ===== Model OSI =====
  { cat: 'osi', level: 1, make() {
    const [item, layer, explain] = pick(OSI_ITEMS);
    const c = [layer - 1, layer + 1, layer - 2, layer + 2, 7, 1]
      .filter(l => l >= 1 && l <= 7 && l !== layer).map(l => LAYERS[l - 1]);
    return makeQuestion('osi', `Na které vrstvě modelu OSI pracuje ${item}?`, LAYERS[layer - 1], c, explain);
  } },
  { cat: 'osi', level: 2, make() {
    const [layer, pdu] = pick(PDUS);
    const c = PDUS.filter(p => p[1] !== pdu).map(p => p[1]).concat(['datagram']);
    return makeQuestion('osi', `Jak se jmenuje jednotka dat (PDU) na vrstvě ${LAYERS[layer - 1]}?`, pdu, c,
      'PDU podle vrstev: 1 bit, 2 rámec, 3 paket, 4 segment, 5–7 data.');
  } },

  // ===== IP adresy =====
  { cat: 'ip', level: 1, make() {
    const priv = pick([
      `10.${octet()}.${octet()}.${hostOctet()}`,
      `172.${16 + rnd(16)}.${octet()}.${hostOctet()}`,
      `192.168.${octet()}.${hostOctet()}`,
    ]);
    const c = [
      `172.${32 + rnd(20)}.${octet()}.${hostOctet()}`,
      `192.169.${octet()}.${hostOctet()}`,
      `11.${octet()}.${octet()}.${hostOctet()}`,
      '8.8.8.8',
      `193.168.${octet()}.${hostOctet()}`,
      `172.${1 + rnd(15)}.${octet()}.${hostOctet()}`,
    ];
    return makeQuestion('ip', 'Která z těchto adres je privátní?', priv, c,
      'Privátní rozsahy: 10.0.0.0/8, 172.16.0.0/12 (172.16–172.31) a 192.168.0.0/16.');
  } },
  { cat: 'ip', level: 2, make() {
    const cls = pick(['A', 'B', 'C']);
    const first = cls === 'A' ? 1 + rnd(126) : cls === 'B' ? 128 + rnd(64) : 192 + rnd(32);
    const ip = `${first}.${octet()}.${octet()}.${hostOctet()}`;
    return makeQuestion('ip', `Do jaké třídy patří adresa ${ip}?`, cls, ['A', 'B', 'C', 'D'],
      `Podle 1. oktetu: A = 1–126, B = 128–191, C = 192–223. ${first} → třída ${cls}.`);
  } },
];

for (const f of FIXED) {
  GENERATORS.push({
    cat: f.cat, level: f.level,
    make: () => makeQuestion(f.cat, f.text, f.correct, f.wrong, f.explain),
  });
}

/*
 * Vybere otázku pro dané patro (level 1–3).
 * cats    – zvolená témata
 * weights – váhy témat (slabší témata mají vyšší váhu → adaptivní učení)
 * recent  – texty nedávných otázek (aby se neopakovaly hned po sobě)
 */
function getQuestion(level, cats, weights, recent) {
  const usable = cats.filter(c => GENERATORS.some(g => g.cat === c && g.level <= level));
  const total = usable.reduce((s, c) => s + (weights[c] || 1), 0);

  let q = null;
  for (let attempt = 0; attempt < 15; attempt++) {
    let r = Math.random() * total;
    let cat = usable[0];
    for (const c of usable) {
      r -= weights[c] || 1;
      if (r <= 0) { cat = c; break; }
    }
    // otázky z aktuální obtížnosti mají dvojnásobnou šanci
    const pool = [];
    for (const g of GENERATORS) {
      if (g.cat !== cat || g.level > level) continue;
      pool.push(g);
      if (g.level === level) pool.push(g);
    }
    q = pick(pool).make();
    if (!recent.includes(q.text)) break;
  }
  return q;
}
