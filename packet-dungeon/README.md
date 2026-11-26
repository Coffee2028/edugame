# 🕹️ Packet Dungeon

**Vzdělávací roguelike střílečka o počítačových sítích.**
Autor: Jakub Steinz · předmět 4ITE PHR – EduGame

▶ **Hrát online:** https://Coffee2028.github.io/packet-dungeon/
📦 **Repozitář:** https://github.com/Coffee2028/packet-dungeon

---

## 🎯 Záměr

Základy počítačových sítí (binární čísla, masky podsítí, porty, model OSI, IP adresy) jsou pro hodně studentů suché učivo. Většinou se „nadrtí“ nazpaměť před testem a pak se zapomenou. Proto jsem je zabalil do rychlé akční hry ve stylu *The Binding of Isaac*. Odpovídání na otázky tu není přestávka od hraní, ale přímo hlavní herní mechanika.

**Cílová skupina:** studenti IT oborů (střední škola, 1. ročník VŠ) a kdokoli, kdo se chystá na CCNA nebo na test ze sítí.

## 🎮 Jak se hraje

| Ovládání | |
|---|---|
| `W` `A` `S` `D` | pohyb |
| šipky | střelba |
| `P` / `Esc` | pauza |

1. V každé místnosti se nahoře zobrazí **otázka** a po místnosti poletují **pakety** s možnými odpověďmi.
2. Hráč musí **sestřelit paket se správnou odpovědí** a zničit všechny viry. Pak se otevřou dveře do další místnosti.
3. **Špatná odpověď se promění ve virus**, který hráče začne honit. Chyba tedy má okamžitý a viditelný následek.
4. Hra má **3 patra** (LAN → WAN → Internet), každé má 4 místnosti a **bosse Firewall**.
5. Firewall je chráněný štítem. Ten spadne jen po správné odpovědi a pak má hráč 6 sekund na to, aby ho postřílel. Potom se štít obnoví a přijde další otázka.
6. Hráč má 3 srdíčka. Po vyčištění místnosti může padnout srdíčko na doplnění.

## 😄 Zábavnost

- **Akční roguelike:** pohyb, střelba, uhýbání, nepřátelé (viry honí hráče, trojské koně po něm střílí) a souboj s bossem.
- **Otázky jsou součástí akce.** Pakety se pohybují, takže hráč musí zároveň přemýšlet, mířit a uhýbat.
- **Stoupající obtížnost:** v každém patře jsou rychlejší a silnější nepřátelé, víc trojských koní a těžší otázky.
- **Riziko a odměna:** tipovat se nevyplácí, protože každý špatný tip znamená další virus v místnosti.
- **Pokaždé jiná hra:** většina otázek se **generuje náhodně** (jiná čísla, adresy, masky), takže se nedají naučit nazpaměť. Hráč musí pochopit princip.
- **Motivace „ještě jeden pokus“:** krátké běhy (5–10 minut), rekordy a vidět, jak se zlepšuju.

## 📚 Co se hráč naučí

| Téma | Příklady otázek | Obtížnost |
|---|---|---|
| Binární soustava | převody bin ↔ dec, hex → dec, počet kombinací n bitů | 1–2 |
| Masky a CIDR | prefix ↔ maska, počet hostů, **adresa sítě a broadcast** | 1–3 |
| Protokoly a porty | HTTP 80, SSH 22, DNS 53…, TCP vs. UDP, ARP, 3-way handshake | 1–3 |
| Model OSI | na které vrstvě pracuje router/switch/hub/TCP…, názvy PDU | 1–2 |
| IP adresy | privátní rozsahy, třídy A/B/C, loopback, APIPA, IPv6, NAT | 1–3 |

- **Po každé odpovědi se zobrazí vysvětlení**, např. *„/26 → bloky po 64 adresách. 77 leží v bloku 64–127, adresa sítě je 192.168.10.64.“* Hráč tak zjistí nejen *co* je správně, ale i *proč*.
- Obtížnost otázek roste s patrem. V 1. patře jsou základy, ve 3. patře výpočty adres sítí a broadcastů.
- Na začátku si hráč může vybrat jen některá témata (např. když se učí jen na test z masek).

## 📈 Měřitelnost pokroku

Hra po každém běhu ukládá výsledky do `localStorage` v prohlížeči (bez serveru a bez registrace). Na obrazovce **„Můj pokrok“** hráč vidí:

1. **Úspěšnost v každém tématu:** procento otázek zodpovězených správně **napoprvé** (když hráč napřed trefí špatný paket, započítá se otázka jako chyba).
2. **Zlepšení:** porovnání úspěšnosti v **prvních 3 a posledních 3 bězích** pro každé téma (▲ / ▼ v procentech).
3. **Úroveň v tématu:** Nováček → Učeň → Pokročilý → Expert podle úspěšnosti.
4. **Graf úspěšnosti v posledních 15 bězích:** je na něm vidět trend. Zelené sloupce jsou vyhrané běhy.
5. **Celkové statistiky:** počet běhů, zodpovězených otázek, výher a nejvzdálenější místnost.

Na konci každého běhu hra navíc ukáže výsledek v jednotlivých tématech a **porovná ho s dosavadním průměrem hráče**.

**Adaptivní učení:** témata, ve kterých hráči dlouhodobě nejde, dostávají vyšší váhu a objevují se častěji. Hra tak sama procvičuje slabá místa.

## 🛠️ Technologie

- čisté **HTML, CSS a JavaScript**, bez knihoven a bez build kroku
- vykreslování přes **Canvas 2D** (60 FPS přes `requestAnimationFrame`)
- ukládání statistik přes **localStorage**

```
packet-dungeon/
├── index.html     – struktura stránky, menu a obrazovky
├── style.css      – vzhled
├── questions.js   – banka a generátory otázek (snadno rozšiřitelné)
├── game.js        – herní smyčka, fyzika, nepřátelé, boss, statistiky
└── README.md
```

### Přidání vlastní otázky

V `questions.js` stačí přidat objekt do pole `FIXED`:

```js
{ cat: 'ports', level: 1, text: 'Na kterém portu běží HTTP?',
  correct: '80', wrong: ['443', '21', '25'],
  explain: 'HTTP používá port 80, šifrované HTTPS port 443.' },
```

## 🚀 Spuštění

- **Online:** přes odkaz nahoře (GitHub Pages).
- **Lokálně:** stačí otevřít `index.html` v prohlížeči.
- Hra je určená pro **PC s klávesnicí**.
