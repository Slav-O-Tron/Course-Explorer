/* Course Explorer Script */

//  Course class (rubric item #3)
class Course {
  constructor(raw) {
    // Defensive defaults to satisfy error-handling rubric
    this.id = String(raw.id ?? "").trim();
    this.title = String(raw.title ?? "").trim();
    this.department = String(raw.department ?? "Unknown").trim();
    this.level = Number(raw.level ?? NaN);
    this.credits = Number(raw.credits ?? NaN);
    this.instructor = String(raw.instructor ?? "TBA").trim();
    this.description = String(raw.description ?? "").trim();
    this.semester = String(raw.semester ?? "Unknown").trim();
  }

  isValid() {
    // id + title are the minimum to show a course
    return this.id.length > 0 && this.title.length > 0;
  }

  // For list display
  listLabel() {
    return `${this.id} — ${this.title}`;
  }

  // For details panel
  detailsText() {
    return [
      `${this.id}`,
      ``,
      `Title: ${this.title}`,
      `Department: ${this.department}`,
      `Level: ${Number.isFinite(this.level) ? this.level : "Unknown"}`,
      `Credits: ${Number.isFinite(this.credits) ? this.credits : "Unknown"}`,
      `Instructor: ${this.instructor || "TBA"}`,
      `Semester: ${this.semester || "Unknown"}`,
      ``,
      this.description || "No description provided."
    ].join("\n");
  }
}

//  DOM elements
const fileInput = document.getElementById("fileInput");
const fileNameEl = document.getElementById("fileName");
const errorBox = document.getElementById("errorBox");

const filterDepartment = document.getElementById("filterDepartment");
const filterLevel = document.getElementById("filterLevel");
const filterCredits = document.getElementById("filterCredits");
const filterInstructor = document.getElementById("filterInstructor");
const sortBy = document.getElementById("sortBy");

const courseListEl = document.getElementById("courseList");
const courseDetailsEl = document.getElementById("courseDetails");

//  App state
let allCourses = [];     // full loaded data
let visibleCourses = []; // filtered/sorted view
let activeCourseId = null;

// Utilities
function showError(msg) {
  errorBox.textContent = msg || "";
}

function enableControls(enabled) {
  [filterDepartment, filterLevel, filterCredits, filterInstructor, sortBy]
    .forEach(el => el.disabled = !enabled);
}

// Semester normalization (rubric item #5.2)
const TERM_ORDER = { Winter: 1, Spring: 2, Summer: 3, Fall: 4 };

function semesterKey(semesterStr) {
  // Expected format: "Fall 2025" etc.
  // If malformed, return very low priority so it sorts last/first safely.
  const parts = semesterStr.trim().split(/\s+/);
  if (parts.length !== 2) return Number.NEGATIVE_INFINITY;

  const [term, yearStr] = parts;
  const year = Number(yearStr);
  const termVal = TERM_ORDER[term];

  if (!termVal || !Number.isFinite(year)) return Number.NEGATIVE_INFINITY;
  return year * 10 + termVal; // easy comparable key
}

function populateSelect(selectEl, values) {
  // preserve "All"
  selectEl.innerHTML = `<option value="All">All</option>`;
  values.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    selectEl.appendChild(opt);
  });
}

// Use Set to generate unique dropdown values (rubric item #4.2)
function buildFiltersFromData(courses) {
  const departments = [...new Set(courses.map(c => c.department).filter(Boolean))].sort();
  const levels = [...new Set(courses.map(c => c.level).filter(Number.isFinite))].sort((a,b)=>a-b);
  const credits = [...new Set(courses.map(c => c.credits).filter(Number.isFinite))].sort((a,b)=>a-b);
  const instructors = [...new Set(courses.map(c => c.instructor).filter(Boolean))].sort();

  populateSelect(filterDepartment, departments);
  populateSelect(filterLevel, levels.map(String));
  populateSelect(filterCredits, credits.map(String));
  populateSelect(filterInstructor, instructors);
}

// Filtering with filter() (rubric item #4.1)
function applyFilters() {
  const deptVal = filterDepartment.value;
  const levelVal = filterLevel.value;
  const creditsVal = filterCredits.value;
  const instrVal = filterInstructor.value;

  visibleCourses = allCourses.filter(c => {
    if (deptVal !== "All" && c.department !== deptVal) return false;
    if (levelVal !== "All" && String(c.level) !== levelVal) return false;
    if (creditsVal !== "All" && String(c.credits) !== creditsVal) return false;
    if (instrVal !== "All" && c.instructor !== instrVal) return false;
    return true;
  });
}

// Sorting with sort() (rubric item #5)
function applySort() {
  const mode = sortBy.value;

  const compareStr = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

  visibleCourses.sort((a, b) => {
    switch (mode) {
      case "id-az": return compareStr(a.id, b.id);
      case "id-za": return compareStr(b.id, a.id);
      case "title-az": return compareStr(a.title, b.title);
      case "title-za": return compareStr(b.title, a.title);
      case "semester-early": return semesterKey(a.semester) - semesterKey(b.semester);
      case "semester-late": return semesterKey(b.semester) - semesterKey(a.semester);
      default: return 0;
    }
  });
}

function renderCourseList() {
  courseListEl.innerHTML = "";

  if (visibleCourses.length === 0) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = "No courses match your filters.";
    courseListEl.appendChild(li);
    courseDetailsEl.className = "details muted";
    courseDetailsEl.textContent = "Click a course to view details.";
    return;
  }

  visibleCourses.forEach(course => {
    const li = document.createElement("li");
    li.textContent = course.listLabel();
    li.dataset.id = course.id;
    if (course.id === activeCourseId) li.classList.add("active");

    li.addEventListener("click", () => {
      activeCourseId = course.id;
      renderCourseList();
      renderDetails(course);
    });

    courseListEl.appendChild(li);
  });
}

function renderDetails(course) {
  courseDetailsEl.className = "details";
  courseDetailsEl.textContent = course.detailsText();
}

function updateView() {
  applyFilters();
  applySort();
  renderCourseList();
}

// File loading (rubric item #2 + #6)
fileInput.addEventListener("change", (e) => {
  showError("");
  activeCourseId = null;

  const file = e.target.files?.[0];
  if (!file) {
    showError("No file selected.");
    return;
  }

  fileNameEl.textContent = `Selected file: ${file.name}`;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);

      if (!Array.isArray(parsed)) {
        showError("Invalid JSON: expected an array of course objects.");
        enableControls(false);
        return;
      }

      const courses = parsed.map(obj => new Course(obj)).filter(c => c.isValid());

      if (courses.length === 0) {
        showError("No valid courses found. Each course needs at least an id and title.");
        enableControls(false);
        return;
      }

      allCourses = courses;
      buildFiltersFromData(allCourses);
      enableControls(true);
      updateView();

    } catch (err) {
      showError("Invalid JSON file format.");
      enableControls(false);
      courseListEl.innerHTML = `<li class="muted">Load a JSON file to see courses.</li>`;
      courseDetailsEl.className = "details muted";
      courseDetailsEl.textContent = "Click a course to view details.";
    }
  };

  reader.onerror = () => {
    showError("Could not read file. Please try again.");
    enableControls(false);
  };

  reader.readAsText(file);
});

//  Control listeners 
[filterDepartment, filterLevel, filterCredits, filterInstructor, sortBy].forEach(el => {
  el.addEventListener("change", () => {
    activeCourseId = null;
    updateView();
  });
});
