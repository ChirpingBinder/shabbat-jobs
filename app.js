const SUPABASE_URL = "https://fupgxfeumsubvxpnmvli.supabase.co";
const SUPABASE_KEY = "sb_publishable_YWiBhQ9Tcu6pPjpDoVJufQ_MQLVKNfR";


const jobs = [
  { name: 'Candles', icon: '🕯️' },
  { name: 'Juice', icon: '🍇' },
  { name: 'Challah', icon: '🍞' }
];

const defaultNames = ['Benji', 'Matan', 'Miriam'];

let settings = {
  kid_1_name: defaultNames[0],
  kid_2_name: defaultNames[1],
  kid_3_name: defaultNames[2]
};

let state = {
  rotation: 0,
  absent_kids: [],
  next_substitutes: {
    "1": 2,
    "2": 3,
    "3": 1
  }
};

const assignmentsEl = document.getElementById('assignments');
const absenceButtonsEl = document.getElementById('absenceButtons');
const statusEl = document.getElementById('status');
const messageEl = document.getElementById('message');

function kidNames() {
  return [
    settings.kid_1_name || 'Kid 1',
    settings.kid_2_name || 'Kid 2',
    settings.kid_3_name || 'Kid 3'
  ];
}

function setMessage(text) {
  messageEl.textContent = text;
}

function normalAssignments() {
  return jobs.map((job, jobIndex) => {
    const kidIndex = (state.rotation + jobIndex) % 3;
    return kidIndex + 1;
  });
}

function otherKidIds(kidId) {
  return [1, 2, 3].filter(id => id !== kidId);
}

function presentKidIds() {
  return [1, 2, 3].filter(
    id => !state.absent_kids.includes(id)
  );
}

function chooseSubstitute(absentKidId) {
  const present = presentKidIds();

  if (present.length === 0) {
    return null;
  }

  const preferred = Number(
    state.next_substitutes[String(absentKidId)]
  );

  if (present.includes(preferred)) {
    return preferred;
  }

  return present[0];
}

function displayedAssignments() {
  const normal = normalAssignments();

  return normal.map(kidId => {
    if (!state.absent_kids.includes(kidId)) {
      return kidId;
    }

    return chooseSubstitute(kidId);
  });
}

function renderAssignments() {
  const assignments = displayedAssignments();
  const names = kidNames();

  assignmentsEl.innerHTML = jobs.map((job, index) => {
    const kidId = assignments[index];
    const kidName = kidId
      ? names[kidId - 1]
      : 'No one';

    return `
      <div class="assignment">
        <div class="job-icon">${job.icon}</div>

        <div>
          <div class="job-name">${job.name}</div>
          <div class="kid-name">${kidName}</div>
        </div>
      </div>
    `;
  }).join('');

  if (state.absent_kids.length === 0) {
    statusEl.textContent = 'Everyone is here';
  } else {
    const absentNames = state.absent_kids
      .map(id => names[id - 1])
      .join(', ');

    statusEl.textContent = `Absent: ${absentNames}`;
  }
}

function renderAbsenceButtons() {
  const names = kidNames();

  absenceButtonsEl.innerHTML = [1, 2, 3].map(id => {
    const selected = state.absent_kids.includes(id);

    return `
      <button
        class="absence-button ${selected ? 'selected' : ''}"
        data-kid-id="${id}"
        type="button"
      >
        ${names[id - 1]}
      </button>
    `;
  }).join('');

  document.querySelectorAll('.absence-button').forEach(button => {
    button.addEventListener('click', () => {
      const id = Number(button.dataset.kidId);

      if (state.absent_kids.includes(id)) {
        state.absent_kids = state.absent_kids.filter(
          kidId => kidId !== id
        );
      } else {
        state.absent_kids = [
          ...state.absent_kids,
          id
        ];
      }

      render();
      saveState();
    });
  });
}

function renderNameInputs() {
  document.getElementById('kid1').value =
    settings.kid_1_name || '';

  document.getElementById('kid2').value =
    settings.kid_2_name || '';

  document.getElementById('kid3').value =
    settings.kid_3_name || '';
}

function render() {
  renderAssignments();
  renderAbsenceButtons();
  renderNameInputs();
}

async function supabaseRequest(table, options = {}) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}`,
    {
      method: options.method || 'GET',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      body: options.body
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status}: ${text}`);
  }

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();

  return text ? JSON.parse(text) : null;
}

async function loadData() {
  try {
    const loadedSettings = await supabaseRequest(
      'shabbat_settings?id=eq.1&select=*'
    );

    const loadedState = await supabaseRequest(
      'shabbat_state?id=eq.1&select=*'
    );

    if (loadedSettings && loadedSettings[0]) {
      settings = loadedSettings[0];
    }

    if (loadedState && loadedState[0]) {
      state = {
        rotation: Number(loadedState[0].rotation) || 0,

        absent_kids: Array.isArray(
          loadedState[0].absent_kids
        )
          ? loadedState[0].absent_kids.map(Number)
          : [],

        next_substitutes:
          loadedState[0].next_substitutes || {
            "1": 2,
            "2": 3,
            "3": 1
          }
      };
    }

    render();
    setMessage('');

  } catch (error) {
    console.error(error);

    render();

    setMessage(
      'Could not connect to Supabase. Check the URL and publishable key.'
    );
  }
}

async function saveState() {
  try {
    await supabaseRequest(
      'shabbat_state?id=eq.1',
      {
        method: 'PATCH',

        headers: {
          Prefer: 'return=minimal'
        },

        body: JSON.stringify({
          rotation: state.rotation,
          absent_kids: state.absent_kids,
          next_substitutes: state.next_substitutes,
          updated_at: new Date().toISOString()
        })
      }
    );

    setMessage('');

  } catch (error) {
    console.error(error);

    setMessage('The change could not be saved.');
  }
}

async function saveNames() {
  const names = {
    kid_1_name:
      document.getElementById('kid1').value.trim() ||
      'Kid 1',

    kid_2_name:
      document.getElementById('kid2').value.trim() ||
      'Kid 2',

    kid_3_name:
      document.getElementById('kid3').value.trim() ||
      'Kid 3'
  };

  try {
    await supabaseRequest(
      'shabbat_settings?id=eq.1',
      {
        method: 'PATCH',

        headers: {
          Prefer: 'return=minimal'
        },

        body: JSON.stringify({
          ...names,
          updated_at: new Date().toISOString()
        })
      }
    );

    settings = {
      ...settings,
      ...names
    };

    render();

    setMessage('Names saved.');

  } catch (error) {
    console.error(error);

    setMessage('The names could not be saved.');
  }
}

function advanceSubstitutePointers() {
  state.absent_kids.forEach(absentKidId => {
    const choices = otherKidIds(absentKidId);

    const current = Number(
      state.next_substitutes[String(absentKidId)]
    );

    const next =
      choices.find(id => id !== current) ||
      choices[0];

    state.next_substitutes[
      String(absentKidId)
    ] = next;
  });
}

async function advanceToNextShabbat() {
  const confirmed = window.confirm(
    'Advance to the next Shabbat? The current absences will be processed and the rotation will move forward.'
  );

  if (!confirmed) {
    return;
  }

  advanceSubstitutePointers();

  state.rotation =
    (state.rotation + 1) % 3;

  state.absent_kids = [];

  render();

  try {
    await saveState();

    setMessage(
      'Advanced to the next Shabbat.'
    );

  } catch (error) {
    console.error(error);
  }
}

document
  .getElementById('saveNames')
  .addEventListener(
    'click',
    saveNames
  );

document
  .getElementById('advanceButton')
  .addEventListener(
    'click',
    advanceToNextShabbat
  );

loadData();