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

Za računovođu koji vodi 40 malih firmi. Početkom mjeseca dobije stotine računa odjednom,
većinom fotografije s mobitela, često krivo uslikane ili odrezane. Knjigovodstvo zna bolje od
bilo kojeg programa, ali nema vremena svaki račun čitati polje po polje. Najviše se boji da mu
prođe duplikat ili krivi iznos. Radi za stolom, na velikom ekranu, i često ga prekidaju.

Zato aplikacija prvo pokaže samo ono što je sumnjivo, čiste račune pusti da brzo potvrdi, a sve
odluke ostaju spremljene pa može nastaviti gdje je stao.

## Odluke

**1. Prvo samo ono sumnjivo, a potvrda je zaključana dok se to ne pogleda.**
Računovođa ne mora gledati svih 15 polja na svakom računu. Gore su samo polja s problemom, ostala
su skrivena. Račun se ne može potvrditi dok se svaki problem ne ispravi ili označi kao provjeren.
Na računu bez problema prikazuje se kratak sažetak (dobavljač, broj, datum, iznos), da se vidi što
se potvrđuje.

**2. Gdje se nešto može izračunati, vjerujem izračunu, a ne postotku pouzdanosti.**
Žiro-računi, ID i PDV brojevi imaju kontrolne znamenke. Ako se slažu, broj je dobro pročitan, pa
nema upozorenja iako je program bio nesiguran. Ako se ne slažu, znam točno koji je broj krivi. Kod
stavki provjeravam količina × cijena = iznos. Na računu IVA KOLAČI tako je od 40 žutih ćelija u
stavkama ostala nula. Lažna upozorenja su skupa: kad ih je previše, računovođa ih počne klikati
bez čitanja i propusti ono pravo.

**3. Nema prozora "Jeste li sigurni?", ali sve se može vratiti.**
Kod stotina računa takav prozor se brzo počne klikati bez čitanja. Umjesto toga: ispravak se
poništava jednim klikom, potvrđen račun vraća se na pregled. Ništa se ne briše: duplikat se
odbaci, ostane vidljiv i može se vratiti. Potvrdu tražim samo za jedinu radnju koja se ne može
vratiti ("Poništi izmjene" na računu).

**4. Namjerno izostavljeno: uređivanje stavki.**
Knjiže se osnovica, PDV i ukupno, a ta polja se mogu ispraviti. Stavke služe za provjeru i to se
radi automatski. Uređivanje 8 redova po 6 ćelija bio bi velik posao za malu korist. Promijenila
bih to ako se pokaže da računovođi stavke trebaju, npr. za firmu koja vodi zalihe.

**5. Namjerno izostavljeno: login.**
Bez backenda login bi bio samo za izgled. Umjesto toga bilježim kada je račun potvrđen ili
odbačen. U pravoj aplikaciji tu bi bilo i ime korisnika.

## Tri pitanja za pravog računovođu

1. Je li datum isporuke nakon datuma računa neobičan u praksi ili se često događa? Ako je često,
   to upozorenje samo smeta.
2. Kako izgleda pravi duplikat: isti račun poslan dvaput, ili ponovno izdan s novim brojem? O tome
   ovisi koliko stroga treba biti provjera.
3. Je li ti naziv artikla bitan za knjiženje, ili gledaš samo iznose i PDV? Zato sam maknula
   upozorenja za opise stavki.

## Kako bih znala da radi

Isti računovođa, isti paket računa, jednom na stari način, jednom u aplikaciji. Mjerila bih:

- **Vrijeme** pregleda jednog računa.
- **Koliko grešaka prođe.** U paket bih namjerno ubacila poznate greške (duplikat, krivi iznos,
  odrezan broj računa) i gledala koliko ih se uhvati. Ovo mi je važnije od brzine.
- **Koliko puta se klikne "Provjereno" bez ispravka.** Ako stalno, upozorenja su preosjetljiva.
- **Koliko se potvrđenih računa kasnije mora ispravljati.**

## Što bih dalje

- Za 2000+ računa: provjera duplikata uspoređuje svaki račun sa svakim. Izmjerila sam 0,2 ms za
  25 računa i oko 400 ms za 2000. Usporedila bih samo račune istog dobavljača.
- Backend umjesto spremanja u preglednik, jer na istim računima radi više ljudi.
- Slanje potvrđenih računa u knjigovodstveni program, s ispravljenim vrijednostima i podatkom tko
  je i kada potvrdio. Ispravci bi mogli služiti i za poboljšanje čitanja.

## AI

Koristila sam Claude: prvu verziju u chatu, a ostalo u Claude Code, izravno u projektu.
`CLAUDE.md` u repozitoriju sadrži pravila i odluke koje sam mu postavila.

Prvu verziju je napisao AI, a ja sam je koristila kao računovođa i gledala originale. Tako sam
našla više stvari koje je trebalo promijeniti. Primjer gdje je AI-jevo pravilo bilo krivo:
provjera je tražila da PDV broj bude jednak ID broju bez prve znamenke. Kod dva računa (SELAK i
Servis Jelić) to nije vrijedilo, a na originalima su brojevi baš tako otisnuti. Razlog: račun je
izdala poslovnica, koja ima svoj ID broj, a PDV broj je od cijele firme. Pravilo sam promijenila
tako da se uspoređuje samo dio broja koji označava firmu, a svaki broj se posebno provjerava po
kontrolnoj znamenki.

Drugi primjer: ispravak polja sam je označavao probleme kao provjerene. Kad sam upisivala ukupni
iznos znamenku po znamenku, upozorenje "Osnovica + PDV ≠ ukupno" se pojavilo i odmah sakrilo, pa
se krivi iznos mogao potvrditi. Sad ispravak ništa ne označava, a upozorenje nestane samo ako je
ispravak dobar.
