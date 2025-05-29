// main.ts
type TaskModule = {
  init: (container: HTMLElement, onBack: () => void) => void;
  cleanup: () => void;
};

const container = document.getElementById("task-container")!;
const selector = document.getElementById("task-selector")!;

// Dynamically import based on data-task
const loadTask = async (taskName: string): Promise<TaskModule> => {
  return (await import(`./tasks/${taskName}.ts`)) as TaskModule;
};

let currentTask: TaskModule | null = null;

selector.addEventListener("click", async (e) => {
  const btn = (e.target as HTMLElement).closest("button[data-task]") as any;
  if (!btn) return;
  const taskName = btn.dataset.task!;
  // hide selector, show container
  selector.style.visibility = "hidden";
  container.hidden = false;

  // load & init
  currentTask = await loadTask(taskName);
  currentTask.init(container, () => {
    // onBack callback
    currentTask!.cleanup();
    container.innerHTML = "";
    selector.style.visibility = "visible";
    container.hidden = true;
    selector.hidden = false;
  });
  selector.hidden = true;
});
