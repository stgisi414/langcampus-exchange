import React from 'react';
import { CloseIcon, TrashIcon } from './Icons.tsx';
import { Note } from '../types.ts';

interface NotesModalProps {
  notes: Note[];
  onClose: () => void;
  onDeleteNote: (noteId: string) => void;
}

const NotesModal: React.FC<NotesModalProps> = ({ notes, onClose, onDeleteNote }) => {
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
            <ul className="space-y-3">
              {notes.map((note) => (
                <li key={note.id} className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg flex justify-between items-start">
                  <div>
                    <p className="text-gray-800 dark:text-gray-200">{note.text}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      From: <em>{note.topic}</em>
                    </p>
                  </div>
                  <button onClick={() => onDeleteNote(note.id)} className="p-1 text-red-500 hover:text-red-700 ml-4">
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-gray-500 dark:text-gray-400">You haven't saved any notes yet. Highlight text in a lesson to save it!</p>
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