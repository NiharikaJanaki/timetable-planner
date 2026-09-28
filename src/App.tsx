import { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import { format, isSameDay, isPast, parseISO } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { Bell, Calendar as CalendarIcon, Check, Plus, Trash2, Clock } from 'lucide-react';

type Task = {
  id: string;
  title: string;
  deadline: string | null; // ISO string
  completed: boolean;
  notified: boolean; // to prevent repeated notifications
};

function App() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('timetable-tasks');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskTime, setNewTaskTime] = useState(''); // HH:MM format
  const [permission, setPermission] = useState<NotificationPermission>('default');

  // Request Notification permission
  useEffect(() => {
    if ('Notification' in window) {
      Notification.requestPermission().then(setPermission);
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('timetable-tasks', JSON.stringify(tasks));
  }, [tasks]);

  // Reminder checker (runs every minute)
  useEffect(() => {
    const interval = setInterval(() => {
      if (permission !== 'granted') return;

      const now = new Date();
      setTasks((prevTasks) => {
        let updated = false;
        const newTasks = prevTasks.map((task) => {
          if (!task.completed && !task.notified && task.deadline) {
            const deadlineDate = parseISO(task.deadline);
            if (isPast(deadlineDate) || Math.abs(deadlineDate.getTime() - now.getTime()) < 60000) {
              // Time has passed or is within the current minute
              new Notification('Deadline Reminder', {
                body: `It's time for: ${task.title}`,
                icon: '/vite.svg'
              });
              updated = true;
              return { ...task, notified: true };
            }
          }
          return task;
        });
        return updated ? newTasks : prevTasks;
      });
    }, 60000);

    return () => clearInterval(interval);
  }, [permission]);

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    let deadlineIso: string | null = null;
    if (newTaskTime) {
      // Combine selectedDate and newTaskTime
      const [hours, minutes] = newTaskTime.split(':');
      const deadline = new Date(selectedDate);
      deadline.setHours(parseInt(hours, 10));
      deadline.setMinutes(parseInt(minutes, 10));
      deadline.setSeconds(0);
      deadlineIso = deadline.toISOString();
    } else {
      // If no time is specified, just set it to the selected date at noon
      const deadline = new Date(selectedDate);
      deadline.setHours(12, 0, 0, 0);
      deadlineIso = deadline.toISOString();
    }

    const newTask: Task = {
      id: uuidv4(),
      title: newTaskTitle,
      deadline: deadlineIso,
      completed: false,
      notified: false,
    };

    setTasks([...tasks, newTask]);
    setNewTaskTitle('');
    setNewTaskTime('');
  };

  const toggleTask = (id: string) => {
    setTasks(tasks.map(t => (t.id === id ? { ...t, completed: !t.completed } : t)));
  };

  const deleteTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  const [viewMode, setViewMode] = useState<'daily' | 'all'>('daily');

  const displayedTasks = viewMode === 'daily'
    ? tasks.filter((t) => t.deadline && isSameDay(parseISO(t.deadline), selectedDate))
    : tasks;

  // Function to highlight days with tasks on the calendar
  const tileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view === 'month') {
      const hasTasks = tasks.some(t => t.deadline && isSameDay(parseISO(t.deadline), date) && !t.completed);
      return hasTasks ? (
        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mx-auto mt-1"></div>
      ) : null;
    }
    return null;
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col md:flex-row gap-8 max-w-7xl mx-auto">
      {/* Calendar Sidebar */}
      <aside className="w-full md:w-1/3 flex flex-col gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <CalendarIcon className="text-blue-500 w-5 h-5" />
            <h2 className="text-xl font-semibold">Calendar</h2>
          </div>
          <Calendar
            onChange={(val) => {
              setSelectedDate(val as Date);
              setViewMode('daily');
            }}
            value={selectedDate}
            tileContent={tileContent}
            className="border-none w-full"
          />
        </div>

        <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="text-blue-500 w-5 h-5" />
            <h3 className="font-semibold text-blue-900">Notifications</h3>
          </div>
          <p className="text-sm text-blue-800">
            {permission === 'granted'
              ? 'Reminders are active. We will notify you when deadlines approach.'
              : 'Please allow notifications to receive deadline reminders.'}
          </p>
          {permission !== 'granted' && permission !== 'denied' && (
            <button
              onClick={() => Notification.requestPermission().then(setPermission)}
              className="mt-3 text-xs bg-blue-500 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-600 transition"
            >
              Enable Notifications
            </button>
          )}
        </div>
      </aside>

      {/* Tasks Main Area */}
      <main className="w-full md:w-2/3 flex flex-col gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-6 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">To-Do List</h1>
              <p className="text-gray-500 mt-1">
                {viewMode === 'daily' ? format(selectedDate, 'EEEE, MMMM do, yyyy') : 'All Scheduled Tasks'}
              </p>
            </div>
            <div className="flex bg-gray-100 p-1 rounded-lg self-start sm:self-auto">
              <button
                onClick={() => setViewMode('daily')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${viewMode === 'daily' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Daily
              </button>
              <button
                onClick={() => setViewMode('all')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${viewMode === 'all' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                All Tasks
              </button>
            </div>
          </div>

          <form onSubmit={addTask} className="flex flex-col sm:flex-row gap-3 mb-8">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="What needs to be done?"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="w-full pl-4 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
            <div className="relative w-full sm:w-32">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Clock className="w-4 h-4 text-gray-400" />
              </div>
              <input
                type="time"
                value={newTaskTime}
                onChange={(e) => setNewTaskTime(e.target.value)}
                className="w-full pl-9 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
            <button
              type="submit"
              disabled={!newTaskTitle.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition"
            >
              <Plus className="w-5 h-5" />
              Add
            </button>
          </form>

          <div className="space-y-3">
            {displayedTasks.length === 0 ? (
              <div className="text-center py-12 px-4 border-2 border-dashed border-gray-200 rounded-2xl">
                <p className="text-gray-500">
                  {viewMode === 'daily' ? 'No tasks for this day. Enjoy your free time!' : 'Your to-do list is empty!'}
                </p>
              </div>
            ) : (
              displayedTasks.map((task) => (
                <div
                  key={task.id}
                  className={`flex items-center justify-between p-4 rounded-xl border ${
                    task.completed ? 'bg-gray-50 border-gray-200 opacity-75' : 'bg-white border-gray-200 shadow-sm hover:border-blue-300'
                  } transition`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <button
                      onClick={() => toggleTask(task.id)}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                        task.completed
                          ? 'bg-blue-500 border-blue-500 text-white'
                          : 'border-gray-300 hover:border-blue-500 text-transparent'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <div>
                      <h4
                        className={`text-lg font-medium ${
                          task.completed ? 'text-gray-500 line-through' : 'text-gray-800'
                        }`}
                      >
                        {task.title}
                      </h4>
                      {task.deadline && (
                        <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                          {viewMode === 'all' && <CalendarIcon className="w-3 h-3 mr-0.5" />}
                          {viewMode === 'all' && format(parseISO(task.deadline), 'MMM d')}
                          {viewMode === 'all' && <span className="mx-1">•</span>}
                          <Clock className="w-3 h-3" />
                          {format(parseISO(task.deadline), 'p')}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                    aria-label="Delete task"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
