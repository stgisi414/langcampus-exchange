// stgisi414/langcampus-exchange/langcampus-exchange-d54d52c6e809974f6d25393478b19cf01e2d62db/components/NotesModal.tsx
import React, { useState } from 'react';
import { CloseIcon, TrashIcon, Bars3Icon, VolumeUpIcon } from './Icons.tsx';
import { Note } from '../types.ts';

interface NotesModalProps {
  notes: Note[];
  onClose: () => void;
  onDeleteNote: (noteId: string) => void;
  onReorderNotes: (newNotes: Note[]) => void;
  onSpeakNote: (text: string, topic: string) => void;
}

const NotesModal: React.FC<NotesModalProps> = ({ notes, onClose, onDeleteNote, onReorderNotes, onSpeakNote }) => {
  const [localNotes, setLocalNotes] = useState(notes);
  const [draggedItem, setDraggedItem] = useState<Note | null>(null);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

  React.useEffect(() => {
    setLocalNotes(notes);
  }, [notes]);

  const handleDragStart = (e: React.DragEvent<HTMLLIElement>, item: Note) => {
    setDraggedItem(item);
    setDraggedItemId(item.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.id);
  };

  const handleDragOver = (e: React.DragEvent<HTMLLIElement>) => {
    e.preventDefault();
    if (!draggedItem) return;

    const targetElement = e.currentTarget;
    const targetId = targetElement.dataset.id;
    if (!targetId || targetId === draggedItem.id) return;

    const targetIndex = localNotes.findIndex(n => n.id === targetId);
    const draggedIndex = localNotes.findIndex(n => n.id === draggedItem.id);

    if (draggedIndex === targetIndex || draggedIndex === -1) return;

    const newNotes = [...localNotes];
    newNotes.splice(draggedIndex, 1);
    newNotes.splice(targetIndex, 0, draggedItem);

    setLocalNotes(newNotes);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDraggedItemId(null);
    onReorderNotes(localNotes);
  };

  const handleSpeak = (text: string, topic: string) => {
      onSpeakNote(text, topic);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl h-[70vh] flex flex-col animate-fade-in-down">
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">My Notes</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200" aria-label="Close Notes">
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto">
          {notes && notes.length > 0 ? (
            <ul 
              className="space-y-3"
              onDragOver={(e) => e.preventDefault()}
            >
              {localNotes.map((note) => (
                <li 
                  key={note.id} 
                  data-id={note.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, note)}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                  className={`bg-gray-100 dark:bg-gray-700 p-4 rounded-lg flex justify-between items-center transition-shadow ${draggedItemId === note.id ? 'opacity-50 shadow-2xl' : 'shadow-md'}`}
                >
                  <div className="flex items-center space-x-3 w-full">
                    
                    <Bars3Icon className="w-6 h-6 text-gray-500 cursor-move flex-shrink-0" title="Drag to reorder" />
                    
                    <div className="flex-grow">
                      <p className="text-gray-800 dark:text-gray-200">{note.text}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        From: <em>{note.topic}</em>
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <button 
                        onClick={() => handleSpeak(note.text, note.topic)} 
                        className="p-1 text-blue-500 hover:text-blue-700 dark:hover:text-blue-300" 
                        title="Read aloud"
                    >
                      <VolumeUpIcon className="w-5 h-5" />
                    </button>
                    
                    <button 
                        onClick={() => onDeleteNote(note.id)} 
                        className="p-1 text-red-500 hover:text-red-700 dark:hover:text-red-300" 
                        title="Delete note"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center p-8 bg-blue-50 dark:bg-gray-700 rounded-lg border border-blue-200 dark:border-gray-600">
              <p className="text-lg font-semibold text-blue-700 dark:text-blue-300 mb-4">You have no saved notes yet.</p>
              <p className="text-gray-600 dark:text-gray-300 space-y-3 text-left">
                To add a note:
              </p>
              <ol className="list-decimal list-inside text-left text-gray-600 dark:text-gray-300 pl-4 space-y-1">
                <li>Go to the **Teach Me** module (Book icon).</li>
                <li>**Highlight** any section of text (up to 200 characters) in the lesson content.</li>
                <li>Click the floating **"Add to Notes"** button that appears.</li>
              </ol>
            </div>
          )}
        </div>
        <div className="flex justify-end p-4 border-t dark:border-gray-700">
          <button onClick={onClose} className="px-6 py-2 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotesModal;