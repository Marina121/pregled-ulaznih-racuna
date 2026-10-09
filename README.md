# Pregled ulaznih računa

Sučelje u kojem računovođa pregledava i potvrđuje račune koje je sustav već pročitao.

## Kako pokrenuti

```bash
npm install && npm run dev
```

Aplikacija se otvori na http://localhost:5173. Potreban je Node.js 20.19 ili noviji.

Odluke (ispravci, potvrde) spremaju se u preglednik. Za povratak na početno stanje: u konzoli
preglednika `localStorage.clear(); location.reload()`.

## Za koga

Za računovođu koji vodi 40 malih firmi. Početkom mjeseca stigne stotine računa odjednom,
većinom fotografije s mobitela, često nakrivo ili s odrezanim rubom. On knjigovodstvo zna bolje
od bilo kojeg programa, ali nema vremena svaki račun čitati polje po polje. Najviše se boji da
mu prođe duplikat ili krivi iznos. Radi za stolom, na velikom ekranu, i često ga netko prekine.

Zato aplikacija prvo pokaže ono što je sumnjivo, čisti račun se potvrdi u par sekundi, a sve
odluke ostaju spremljene, pa se može nastaviti tamo gdje se stalo.

## Što aplikacija radi

- Popis računa s obojenom trakom po stanju (greška, upozorenje, spreman, potvrđen, duplikat),
  pretragom po dobavljaču, broju ili iznosu i izbornikom klijenata.
- Original računa uz izvučene podatke, sa zumom do 400 % i pomicanjem mišem.
- Automatske provjere: obavezna polja, osnovica + PDV = ukupno, zbroj stavki, datumi (i njihov
  oblik), kupac je pravi klijent, kontrolne znamenke žiro-računa, ID i PDV brojeva, duplikati.
- Ispravak polja, oznaka "Provjereno", odluka o duplikatu, potvrda i vraćanje na pregled.
- U sažetku računa vidi se što je ispravljeno ("Valuta: prazno → BAM").
- Izvoz potvrđenih računa u CSV, s ispravljenim vrijednostima, vremenom potvrde i popisom ispravaka.

## Odluke

**1. Na vrhu je samo ono sumnjivo, a potvrda je zaključana dok se to ne pogleda.**
Na računu ima 15 polja, a obično su sumnjiva jedno ili dva. Ta su gore, ostala su skrivena.
Gumb Potvrdi radi tek kad je svaki problem ispravljen ili označen kao provjeren. Na računu bez
problema umjesto praznog panela stoji kratak sažetak (dobavljač, broj, datumi, iznos), da se
vidi što se potvrđuje.

**2. Ono što se može izračunati ima prednost pred postotkom pouzdanosti.**
Žiro-računi, ID i PDV brojevi imaju kontrolne znamenke: zadnje znamenke izračunaju se iz ostalih.
Ako se slažu, broj je dobro pročitan i upozorenja nema, čak i kad je sustav bio nesiguran. Ako se
ne slažu, označen je baš taj broj. Stavke se provjeravaju istim načinom: količina × cijena mora
dati iznos. Na računu IVA KOLAČI je tako od 40 žutih ćelija u stavkama ostala nula.
Razlog: ako je upozorenja previše, računovođa ih počne preskakati bez čitanja i promakne mu ono
koje je stvarno važno.

**3. Nema prozora "Jeste li sigurni?", ali sve se može vratiti.**
Kod stotina računa takav prozor se brzo klika bez čitanja, pa ništa ne štiti. Umjesto toga:
ispravak se poništava jednim klikom, potvrđen račun se vraća na pregled, a duplikat se ne briše
nego odbaci i ostaje vidljiv. Drugi klik traži se samo za jedinu radnju koja se ne može vratiti
("Poništi izmjene" na računu).

**4. Namjerno izostavljeno: uređivanje stavki.**
Knjiže se osnovica, PDV i ukupno, a ta polja se mogu ispraviti. Stavke služe za provjeru, i ta
provjera je automatska. Tablica za uređivanje 8 redova po 6 ćelija bila bi velik posao za malu
korist. To bi se promijenilo ako se pokaže da stavke trebaju, npr. firmi koja vodi zalihe.

**5. Namjerno izostavljeno: login.**
Bez backenda login bi bio samo za izgled, lozinku ne bi imao tko provjeriti. Umjesto toga
bilježi se kada je račun potvrđen ili odbačen. U pravoj aplikaciji uz to bi išlo i ime korisnika.

## Tri pitanja za pravog računovođu

1. Je li datum isporuke nakon datuma računa neobičan u praksi ili se često događa? Ako je često,
   to upozorenje samo smeta.
2. Kako izgleda pravi duplikat: isti račun poslan dvaput, ili ponovno izdan s novim brojem? O tome
   ovisi koliko stroga treba biti provjera.
3. Je li ti naziv artikla bitan za knjiženje, ili gledaš samo iznose i PDV? Zato sam maknula
   upozorenja za opise stavki.

## Kako bih znala da radi

Isti računovođa i isti paket računa, jednom na stari način, jednom u aplikaciji. Mjerila bih:

- **Vrijeme** pregleda jednog računa.
- **Koliko grešaka prođe.** U paket bih namjerno ubacila poznate greške (duplikat, krivi iznos,
  odrezan broj računa) i gledala koliko ih se uhvati. To mi je važnije od brzine.
- **Koliko puta se klikne "Provjereno" bez ispravka.** Ako se to događa stalno, upozorenja su
  preosjetljiva.
- **Koliko se potvrđenih računa kasnije mora ispravljati.**

## Što bih dalje

- Za 2000+ računa: provjera duplikata uspoređuje svaki račun sa svakim. Izmjerila sam 0,2 ms za
  25 računa i oko 400 ms za 2000. Usporedila bih samo račune istog dobavljača.
- Backend umjesto spremanja u preglednik, jer na istim računima radi više ljudi.
- Umjesto CSV-a, slanje potvrđenih računa izravno u knjigovodstveni program, uz ime korisnika
  koji je potvrdio. Ispravci bi mogli služiti i za poboljšanje čitanja.
- Na slici originala označiti gdje je program pročitao polje. Za to bi trebale koordinate, kojih u
  podacima nema.

## AI

Koristila sam Claude: prvu verziju u chatu, a ostalo u Claude Code, izravno u projektu. Pravila
i odluke koje sam mu postavila su u `CLAUDE.md`.

Prvu verziju je napisao AI. Ja sam je koristila kao da sam računovođa i uspoređivala s
originalima računa, i tako našla što ne valja.

Primjer: AI je napisao provjeru da PDV broj mora biti jednak ID broju bez prve znamenke. Kod
računa SELAK i Servis Jelić to nije vrijedilo, a na originalima su brojevi baš tako otisnuti.
Račun je izdala poslovnica, koja ima svoj ID broj, a PDV broj je od cijele firme. Provjeru sam
promijenila tako da se uspoređuje samo dio broja koji označava firmu, a svaki broj se posebno
provjerava po kontrolnoj znamenki.

Drugi primjer: kad se polje ispravi, AI-jev kod je sve probleme tog polja označavao kao
provjerene. Kad sam ukupni iznos upisivala znamenku po znamenku, upozorenje "Osnovica + PDV ≠
ukupno" bi se pojavilo i odmah nestalo, pa se krivi iznos mogao potvrditi. Sad ispravak ništa ne
označava, a upozorenje nestane samo ako je ispravak stvarno dobar.
