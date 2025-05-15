document.addEventListener('DOMContentLoaded', () => {
    // Nur ausführen, wenn wir auf der Kalkulator-Seite sind
    if (!document.getElementById('kalkulator-hauptbereich')) {
        return;
    }

    const kategorieKachelnContainer = document.getElementById('kategorie-kacheln');
    const optionenBereich = document.getElementById('optionen-bereich');
    const optionenTitelElement = document.getElementById('optionen-titel');
    const unteroptionenContainer = document.getElementById('unteroptionen-container');
    const mengeContainer = document.getElementById('menge-container');
    const optionMengeInput = document.getElementById('option-menge');
    const zusatzleistungenBereich = document.getElementById('zusatzleistungen-bereich');
    const zusatzleistungenContainer = document.getElementById('zusatzleistungen-container');
    
    const stundensatzInput = document.getElementById('stundensatz');
    const projektrabattInput = document.getElementById('projektrabatt');
    const gesamtpreisElement = document.getElementById('gesamtpreis');
    const resetButton = document.getElementById('reset-button');

    let KDATA = null; // Hier werden die Daten aus services.json gespeichert
    let aktuelleAuswahl = {
        kategorieId: null,
        optionId: null,
        menge: 1,
        zusatzleistungenIds: []
    };

    async function ladeKalkulatorDaten() {
        try {
            const response = await fetch('services.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            KDATA = await response.json();
            initialisiereKalkulator();
        } catch (error) {
            console.error("Fehler beim Laden der Kalkulatordaten:", error);
            kategorieKachelnContainer.innerHTML = "<p>Fehler beim Laden der Produktdaten. Bitte versuchen Sie es später erneut.</p>";
        }
    }

    function initialisiereKalkulator() {
        // Standardwerte für Sidebar setzen
        stundensatzInput.value = KDATA.basisDatenDefaults.stundensatz;
        projektrabattInput.value = KDATA.basisDatenDefaults.projektrabatt;

        // Kategorie-Kacheln erstellen
        KDATA.kategorien.forEach(kategorie => {
            const kachel = document.createElement('div');
            kachel.classList.add('kategorie-kachel');
            kachel.textContent = kategorie.name;
            kachel.dataset.kategorieId = kategorie.id;
            kachel.addEventListener('click', () => handleKategorieWahl(kategorie));
            kategorieKachelnContainer.appendChild(kachel);
        });

        // Event Listener für Sidebar-Eingaben und Menge
        stundensatzInput.addEventListener('change', berechneGesamtpreis);
        projektrabattInput.addEventListener('change', berechneGesamtpreis);
        optionMengeInput.addEventListener('change', () => {
            aktuelleAuswahl.menge = parseInt(optionMengeInput.value) || 1;
            berechneGesamtpreis();
        });
        resetButton.addEventListener('click', resetKalkulation);
    }

    function handleKategorieWahl(kategorie) {
        resetAuswahlStufen();
        aktuelleAuswahl.kategorieId = kategorie.id;

        // Visuelles Feedback für ausgewählte Kachel
        document.querySelectorAll('.kategorie-kachel').forEach(k => k.classList.remove('selected'));
        event.target.classList.add('selected');

        optionenTitelElement.textContent = `2. ${kategorie.unteroptionenTitel || 'Option wählen:'}`;
        optionenBereich.classList.remove('hidden');
        resetButton.classList.remove('hidden');

        // Unteroptionen (Radio-Buttons) erstellen
        unteroptionenContainer.innerHTML = ''; // Alte Optionen löschen
        kategorie.optionen.forEach(option => {
            const label = document.createElement('label');
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'unteroption';
            radio.value = option.id;
            radio.dataset.optionId = option.id; // für einfacheren Zugriff auf die Option
            
            radio.addEventListener('change', () => handleUnteroptionWahl(kategorie, option));
            
            label.appendChild(radio);
            label.appendChild(document.createTextNode(` ${option.name} (${formatPreis(berechneEinzelpostenPreis(option, 1))} ${option.einheit || ''})`));
            unteroptionenContainer.appendChild(label);
        });
    }
    
    function handleUnteroptionWahl(kategorie, gewaehlteOption) {
        aktuelleAuswahl.optionId = gewaehlteOption.id;
        aktuelleAuswahl.menge = 1; // Menge zurücksetzen
        optionMengeInput.value = 1;

        if (gewaehlteOption.mengeAktiv) {
            mengeContainer.classList.remove('hidden');
            const mengenLabelElement = mengeContainer.querySelector('label');
            if (gewaehlteOption.mengenLabel) {
                mengenLabelElement.textContent = `${gewaehlteOption.mengenLabel}:`;
            } else {
                 mengenLabelElement.textContent = `Menge:`;
            }
        } else {
            mengeContainer.classList.add('hidden');
        }

        // Zusatzleistungen anzeigen
        if (kategorie.zusatzleistungen && kategorie.zusatzleistungen.length > 0) {
            zusatzleistungenBereich.classList.remove('hidden');
            zusatzleistungenContainer.innerHTML = ''; // Alte Zusatzleistungen löschen
            kategorie.zusatzleistungen.forEach(leistung => {
                const label = document.createElement('label');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = leistung.id;
                checkbox.dataset.leistungId = leistung.id;

                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        aktuelleAuswahl.zusatzleistungenIds.push(leistung.id);
                    } else {
                        aktuelleAuswahl.zusatzleistungenIds = aktuelleAuswahl.zusatzleistungenIds.filter(id => id !== leistung.id);
                    }
                    berechneGesamtpreis();
                });
                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(` ${leistung.name} (+ ${formatPreis(berechneEinzelpostenPreis(leistung, aktuelleAuswahl.menge, gewaehlteOption))} ${leistung.einheit || ''})`));
                zusatzleistungenContainer.appendChild(label);
            });
        } else {
            zusatzleistungenBereich.classList.add('hidden');
            zusatzleistungenContainer.innerHTML = '';
        }
        berechneGesamtpreis();
    }

    function berechneEinzelpostenPreis(item, menge = 1, basisOptionFuerFaktor = null) {
        const stundensatz = parseFloat(stundensatzInput.value) || KDATA.basisDatenDefaults.stundensatz;
        let preis = 0;

        switch (item.berechnungsTyp) {
            case 'fix':
                preis = item.basisPreis * (item.mengeAktiv ? menge : 1);
                break;
            case 'stundenbasiert':
                preis = item.basisPreis * stundensatz; // basisPreis ist hier die Stundenzahl
                break;
            case 'faktorBasis':
                if (item.bezogenAuf === 'option' && basisOptionFuerFaktor) {
                    const basisPreisOption = basisOptionFuerFaktor.basisPreis * (basisOptionFuerFaktor.mengeAktiv ? menge : 1);
                    preis = basisPreisOption * item.faktor;
                } else { // Fallback oder andere Bezugspunkte (hier nicht implementiert)
                    preis = 0; 
                }
                break;
            default:
                preis = 0;
        }
        return preis;
    }

    function berechneGesamtpreis() {
        if (!KDATA || !aktuelleAuswahl.kategorieId || !aktuelleAuswahl.optionId) {
            gesamtpreisElement.textContent = formatPreis(0);
            return;
        }

        let gesamt = 0;
        const kategorie = KDATA.kategorien.find(k => k.id === aktuelleAuswahl.kategorieId);
        const hauptOption = kategorie.optionen.find(o => o.id === aktuelleAuswahl.optionId);

        // Preis für Hauptoption
        if (hauptOption) {
            gesamt += berechneEinzelpostenPreis(hauptOption, aktuelleAuswahl.menge);
        }
        
        // Preise für Zusatzleistungen
        aktuelleAuswahl.zusatzleistungenIds.forEach(leistungId => {
            const leistung = kategorie.zusatzleistungen.find(l => l.id === leistungId);
            if (leistung) {
                 // Für faktorBasis bei Zusatzleistungen, muss die Hauptoption als Basis übergeben werden
                const basisFuerFaktor = (leistung.bezogenAuf === 'option') ? hauptOption : null;
                gesamt += berechneEinzelpostenPreis(leistung, aktuelleAuswahl.menge, basisFuerFaktor);
            }
        });

        // Rabatt abziehen
        const rabattProzent = parseFloat(projektrabattInput.value) || 0;
        if (rabattProzent > 0) {
            gesamt = gesamt * (1 - (rabattProzent / 100));
        }

        gesamtpreisElement.textContent = formatPreis(gesamt);
    }

    function formatPreis(wert) {
        return wert.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
    }
    
    function resetAuswahlStufen() {
        // Setzt Auswahl ab Stufe 2 zurück
        aktuelleAuswahl.optionId = null;
        aktuelleAuswahl.menge = 1;
        aktuelleAuswahl.zusatzleistungenIds = [];

        optionenBereich.classList.add('hidden');
        unteroptionenContainer.innerHTML = '';
        mengeContainer.classList.add('hidden');
        optionMengeInput.value = 1;
        zusatzleistungenBereich.classList.add('hidden');
        zusatzleistungenContainer.innerHTML = '';
        gesamtpreisElement.textContent = formatPreis(0);
    }

    function resetKalkulation() {
        aktuelleAuswahl.kategorieId = null;
        resetAuswahlStufen();
        
        document.querySelectorAll('.kategorie-kachel').forEach(k => k.classList.remove('selected'));
        resetButton.classList.add('hidden');

        // Optional: Sidebar-Werte auch zurücksetzen
        // stundensatzInput.value = KDATA.basisDatenDefaults.stundensatz;
        // projektrabattInput.value = KDATA.basisDatenDefaults.projektrabatt;
        // berechneGesamtpreis(); // Falls Sidebar-Werte zurückgesetzt werden
    }

    // Lade die Daten, wenn das Skript gestartet wird
    ladeKalkulatorDaten();
});