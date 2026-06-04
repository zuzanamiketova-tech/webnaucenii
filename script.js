// ==========================================
// TO-DO LIST
// ==========================================
const todos = [];

function renderTodos() {
    const list = document.getElementById('todo-list');
    if (!list) return;
    list.innerHTML = '';
    todos.forEach((todo, i) => {
        const div = document.createElement('div');
        div.className = `todo-item ${todo.completed ? 'completed' : ''}`;
        div.innerHTML = `
            <input type="checkbox" ${todo.completed ? 'checked' : ''} onchange="toggleTodo(${i})">
            <span>${todo.text}</span>
        `;
        list.appendChild(div);
    });
}

function addTodo() {
    const input = document.getElementById('todo-input-field');
    if (input && input.value.trim()) {
        todos.push({ text: input.value.trim(), completed: false });
        input.value = '';
        renderTodos();
    }
}

function toggleTodo(i) {
    todos[i].completed = !todos[i].completed;
    renderTodos();
}

renderTodos();

// ==========================================
// ČASOVAČ LÁTKY
// ==========================================
let totalSeconds = 0;
let timerInterval = null;

function updateTimer() {
    const hrs = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const secs = String(totalSeconds % 60).padStart(2, '0');
    const timerElement = document.getElementById('test-timer');
    if (timerElement) timerElement.textContent = `${hrs}:${mins}:${secs}`;
}

function startTimer() {
    if (!timerInterval) {
        timerInterval = setInterval(() => {
            totalSeconds++;
            updateTimer();
        }, 1000);
    }
    const btn = document.getElementById('timer-toggle-btn');
    if (btn) btn.textContent = "Pauza";
}

function pauseTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    const btn = document.getElementById('timer-toggle-btn');
    if (btn) btn.textContent = "Spustit";
}

function toggleTimer() {
    if (timerInterval) { pauseTimer(); } else { startTimer(); }
}

function resetTimer() {
    pauseTimer();
    totalSeconds = 0;
    updateTimer();
}

// ==========================================
// KOMBINOVANÝ INTERNETOVÝ + AI GENERÁTOR
// ==========================================
let currentQuestions = [];

async function switchToTest() {
    const topicInput = document.getElementById('topic-input');
    const countInput = document.getElementById('question-count-input');
    const difficultyInput = document.getElementById('difficulty-select'); 
    
    if (!topicInput || !countInput) return;
    
    const topic = topicInput.value.trim();
    const count = parseInt(countInput.value);
    const difficulty = difficultyInput ? difficultyInput.value : "lehka";

    if (!topic) {
        alert("Nejdříve prosím zadej téma studia!");
        return;
    }

    document.getElementById('dashboard-view').classList.add('hidden');
    document.getElementById('test-view').classList.remove('hidden');
    
    const container = document.getElementById('test-content');
    container.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <i class="fas fa-spinner fa-spin" style="font-size: 3rem; color: #ff69b4; margin-bottom: 20px;"></i>
            <h2>Generuji test na míru...</h2>
            <p>Připravuji unikátní otázky pro téma: <strong>${topic}</strong></p>
        </div>`;

    resetTimer();

    const cleanTopic = topic.toLowerCase()
        .replace(/á/g, 'a').replace(/é/g, 'e').replace(/ě/g, 'e').replace(/í/g, 'i')
        .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ů/g, 'u').replace(/ý/g, 'y')
        .replace(/č/g, 'c').replace(/ď/g, 'd').replace(/ň/g, 'n').replace(/ř/g, 'r')
        .replace(/š/g, 's').replace(/ť/g, 't').replace(/ž/g, 'z');

    const isMath = cleanTopic.includes("zlomk") || cleanTopic.includes("procent") || 
                   cleanTopic.includes("rovnic") || cleanTopic.includes("nasobilk") || 
                   cleanTopic.includes("matematik") || cleanTopic.includes("pocitani");

    if (isMath) {
        generateAiMathQuestions(cleanTopic, count, difficulty);
        renderTest(topic);
        startTimer();
        return;
    }

    // POKUS 1: WIKIPEDIE
    try {
        const apiUrl = `https://cs.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=1&explaintext=1&titles=${encodeURIComponent(topic)}&origin=*`;
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        const pages = data.query.pages;
        const pageId = Object.keys(pages)[0];
        
        if (pageId === "-1") {
            throw new Error("Nenalezeno");
        }

        const text = pages[pageId].extract;
        const sentences = text.split(/[.!?]/).map(s => s.trim()).filter(s => s.length > 25);
        
        if (sentences.length < 2) throw new Error("Málo textu");

        currentQuestions = [];
        const limit = Math.min(count, sentences.length);

        for (let i = 0; i < limit; i++) {
            const fullSentence = sentences[i];
            const words = fullSentence.split(" ");
            const missingWordIndex = Math.floor(words.length / 2);
            const correctAnswer = words[missingWordIndex].replace(/[,.()]/g, "");
            
            words[missingWordIndex] = "_______";
            const cleanQuestionText = `"${words.join(" ") + "."}"`;

            let badOpt1 = "chyba";
            let badOpt2 = "nepravda";
            if (sentences[i + 1]) {
                const nextWords = sentences[i + 1].split(" ");
                badOpt1 = nextWords[Math.floor(nextWords.length / 3)].replace(/[,.()]/g, "") || "kontext";
                badOpt2 = nextWords[Math.floor(nextWords.length / 2)].replace(/[,.()]/g, "") || "výraz";
            }

            if (badOpt1 === correctAnswer) badOpt1 += "a";
            if (badOpt2 === correctAnswer || badOpt2 === badOpt1) badOpt2 += "b";

            currentQuestions.push({
                q: cleanQuestionText,
                opts: [correctAnswer, badOpt1, badOpt2],
                correct: 0,
                step: `Správné znění: "${fullSentence}."`
            });
        }

        renderTest(topic);
        startTimer();

    } catch (error) {
        // POKUS 2: INTERNET SELHAL -> NASTUPUJE UNIKÁTNÍ VŠEOBECNÝ AI GENERÁTOR
        generateAiFallbackQuestions(topic, count, difficulty);
        renderTest(topic);
        startTimer();
    }
}

// ==========================================
// UNIKÁTNÍ AI ENGINE PRO MATEMATIKU
// ==========================================
function generateAiMathQuestions(type, count, diff) {
    currentQuestions = [];

    // Základní větvení obtížnosti, které se s každou otázkou dynamicky mění
    let baseMultiplier = diff === "lehka" ? 1 : (diff === "stredni" ? 3 : 6);

    for (let i = 0; i < count; i++) {
        let qText = "";
        let correctAns = "";
        let opts = [];
        let stepText = "";

        // ✅ Každý krok v cyklu (i) používá jiná náhodná čísla a operace -> OTÁZKY NEBUDOU STEJNÉ
        if (type.includes("zlomk")) {
            let jmenovatel = (diff === "lehka" ? 4 : (diff === "stredni" ? 8 : 12)) + (i % 3); // Mění jmenovatele podle indexu
            let citatel1 = Math.floor(Math.random() * 3) + 1;
            let citatel2 = Math.floor(Math.random() * 3) + 1;
            
            // Střídání sčítání a odčítání zlomků
            if (i % 2 === 0) {
                qText = `Vypočítej matematický zlomek: ${citatel1}/${jmenovatel} + ${citatel2}/${jmenovatel} = ?`;
                correctAns = `${citatel1 + citatel2}/${jmenovatel}`;
                opts = [correctAns, `${citatel1}/${jmenovatel}`, `${citatel1 + citatel2 + 1}/${jmenovatel}`];
                stepText = `Při sčítání zlomků se stejným jmenovatelem sečteme čitatele: ${citatel1} + ${citatel2} = ${citatel1 + citatel2}.`;
            } else {
                let velkyCitatel = citatel1 + citatel2;
                qText = `Vypočítej matematický zlomek: ${velkyCitatel}/${jmenovatel} - ${citatel2}/${jmenovatel} = ?`;
                correctAns = `${velkyCitatel - citatel2}/${jmenovatel}`;
                opts = [correctAns, `${velkyCitatel}/${jmenovatel}`, `1/${jmenovatel}`];
                stepText = `Při odčítání zlomků se stejným jmenovatelem odečteme čitatele: ${velkyCitatel} - ${citatel2} = ${velkyCitatel - citatel2}.`;
            }

        } else if (type.includes("procent")) {
            // Každá otázka dostane jiný základ a jiné procento
            let zaklad = (diff === "lehka" ? 100 : (diff === "stredni" ? 200 : 400)) + (i * 50);
            let proc = (diff === "lehka" ? 10 : (diff === "stredni" ? 15 : 12)) + (i * 2);
            let vysledek = (zaklad * proc) / 100;

            qText = `Vypočítej hodnotu: Kolik je ${proc} % ze základu ${zaklad}?`;
            correctAns = `${vysledek}`;
            opts = [correctAns, `${vysledek + zaklad / 10}`, `${vysledek * 2}`];
            stepText = `1 % ze základu ${zaklad} je ${zaklad / 100}. Vynásobíme počtem procent: ${zaklad / 100} * ${proc} = ${vysledek}.`;

        } else {
            // Rovnice - pokaždé jiné koeficienty a výsledky
            let a = Math.floor(Math.random() * 3) + 2 + i;
            let x = Math.floor(Math.random() * 4) + 1 + (i % 2);
            let b = Math.floor(Math.random() * 8) + 2;
            let c = a * x + b;

            qText = `Vyřeš rovnici a urči hodnotu neznámé x: ${a}x + ${b} = ${c}`;
            correctAns = `x = ${x}`;
            opts = [correctAns, `x = ${x + i + 1}`, `x = ${x - 1}`];
            stepText = `Odečteme číslo ${b}: ${a}x = ${c - b}. Vydělíme číslem ${a}: x = ${x}.`;
        }

        currentQuestions.push({
            q: qText,
            opts: opts,
            correct: 0,
            step: stepText
        });
    }
}

// ==========================================
// UNIKÁTNÍ AI VŠEOBECNÝ FALLBACK
// ==========================================
function generateAiFallbackQuestions(topic, count, diff) {
    currentQuestions = [];
    
    // Různé šablony otázek, aby se úkoly u humanitních témat neopakovaly
    const questionTemplates = [
        (t) => `Které z následujících tvrzení představuje základní historický či teoretický pilíř pro téma "${t}"?`,
        (t) => `Jaký je doporučený a metodicky správný postup při hlubším zkoumání nebo rozboru látky "${t}"?`,
        (t) => `Čemu je nutné věnovat největší pozornost, pokud chceme správně interpretovat hlavní principy v tématu "${t}"?`,
        (t) => `Která z možností popisuje nejčastější chybu, které se studenti při analýze tématu "${t}" dopouštějí?`,
        (t) => `Jaké logické vazby a vnitřní strukturu bychom měli uplatnit pro úspěšné zvládnutí látky "${t}"?`
    ];

    for (let i = 0; i < count; i++) {
        let templateIndex = i % questionTemplates.length;
        let qText = questionTemplates[templateIndex](topic);
        
        let opt1 = `Důkladné ověření faktů, porozumění klíčovým pojmům a sledování logické struktury v kontextu stupně ${diff}.`;
        let opt2 = `Ignorování všech vědeckých poznatků, metodických postupů a spoléhání se na smyšlené údaje.`;
        let opt3 = `Slepé mechanické zapamatování celých pasáží textu bez jakékoliv vnitřní vazby či pochopení.`;

        // Jemná variace matoucích možností, aby nebyly identické
        if (i % 2 === 1) {
            opt2 = `Přeskočení základních principů a okamžitá snaha o řešení nejkomplexnějších problémů bez přípravy.`;
            opt3 = `Absence jakékoliv systematické práce s pojmy a odmítání logického uvažování.`;
        }

        currentQuestions.push({
            q: qText,
            opts: [opt1, opt2, opt3],
            correct: 0,
            step: `Úroveň ${diff} vyžaduje systematické řazení informací od jednodušších vazeb k těm složitějším.`
        });
    }
}

// ==========================================
// VYKRESLENÍ TESTU (ZDROJE KOMPLETNĚ VYMAZÁNY)
// ==========================================
function renderTest(topic) {
    const container = document.getElementById('test-content');
    if (!container) return;

    // Čisté rozhraní bez jakýchkoliv odkazů, textů či boxíků na konci
    container.innerHTML = `<h2>Vygenerovaný test pro téma: ${topic}</h2>`;
    
    currentQuestions.forEach((q, index) => {
        const shuffledIndexes = [0, 1, 2].sort(() => Math.random() - 0.5);

        let questionHtml = `
            <div class="question-card" id="q-card-${index}">
                <p><strong>${index + 1}. ${q.q}</strong></p>
                <div class="options-group">`;
        
        shuffledIndexes.forEach((originalIndex, order) => {
            const optText = q.opts[originalIndex];
            questionHtml += `
                <div>
                    <input type="radio" name="question-${index}" value="${originalIndex}" id="q-${index}-o-${order}">
                    <label for="q-${index}-o-${order}">${optText}</label>
                </div>`;
        });
        
        questionHtml += `</div><div id="feedback-${index}"></div></div>`;
        container.innerHTML += questionHtml;
    });

    container.innerHTML += `<button id="submit-test-btn" class="btn-main" onclick="evaluateTest()"><i class="fas fa-check-double"></i> Odevzdat a zkontrolovat test</button>`;
}

// ==========================================
// VYHODNOCENÍ TESTU
// ==========================================
function evaluateTest() {
    pauseTimer();
    let score = 0;
    
    currentQuestions.forEach((q, index) => {
        const feedbackDiv = document.getElementById(`feedback-${index}`);
        const selected = document.querySelector(`input[name="question-${index}"]:checked`);
        let isCorrect = false;

        if (selected && parseInt(selected.value) === q.correct) {
            isCorrect = true;
        }

        if (isCorrect) {
            score++;
            feedbackDiv.innerHTML = `
                <div class="result-box correct">
                    <i class="fas fa-check-circle"></i> <strong>Správně!</strong> Tvá odpověď je bezchybná.
                </div>`;
        } else {
            const userAnsText = selected ? q.opts[parseInt(selected.value)] : "Nevyplněno";
            const correctValue = q.opts[q.correct];
            
            feedbackDiv.innerHTML = `
                <div class="result-box incorrect">
                    <i class="fas fa-times-circle"></i> <strong>Chyba!</strong> Zadáno: "${userAnsText}". Správně: <strong>${correctValue}</strong>.<br>
                    <button class="why-btn" onclick="toggleExplanation(${index})"><i class="fas fa-question-circle"></i> Ukázat vysvětlení</button>
                    <div id="why-box-${index}" class="hidden explanation-step">${q.step}</div>
                </div>`;
        }
    });

    const container = document.getElementById('test-content');
    const scoreBanner = document.createElement('div');
    scoreBanner.className = 'score-banner';
    scoreBanner.innerHTML = `<i class="fas fa-poll-h"></i> Test úspěšně dokončen! Skóre: ${score} z ${currentQuestions.length} správně.`;
    container.insertBefore(scoreBanner, container.firstChild);

    document.getElementById('submit-test-btn').classList.add('hidden');
}

function toggleExplanation(index) {
    const box = document.getElementById(`why-box-${index}`);
    if (box.classList.contains('hidden')) {
        box.classList.remove('hidden');
    } else {
        box.classList.add('hidden');
    }
}

function switchToDash() {
    pauseTimer();
    document.getElementById('test-view').classList.add('hidden');
    document.getElementById('dashboard-view').classList.remove('hidden');
}