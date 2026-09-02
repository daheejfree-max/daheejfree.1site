'use client';

import React, { useState } from 'react';
import { Sparkles, Check, RefreshCw, X, MessageSquare, BookOpen, HeartHandshake } from 'lucide-react';

interface AIBioAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  gender: 'male' | 'female';
  initialProfession?: string;
  initialEducation?: string;
  onApplyBio: (bio: string, icebreakers?: string[]) => void;
}

export const AIBioAssistantModal: React.FC<AIBioAssistantModalProps> = ({
  isOpen,
  onClose,
  gender,
  initialProfession = '',
  initialEducation = '',
  onApplyBio,
}) => {
  const [profession, setProfession] = useState(initialProfession);
  const [education, setEducation] = useState(initialEducation);
  const [prayerHabits, setPrayerHabits] = useState('Always observes 5 daily prayers');
  const [religiousPractice, setReligiousPractice] = useState('Sunnah practicing & Halal lifestyle');
  const [hobbies, setHobbies] = useState('Islamic study, family time, community charity');
  const [seekingTraits, setSeekingTraits] = useState('God-fearing, humble, family-oriented, anti-dowry');

  const [loading, setLoading] = useState(false);
  const [generatedBio, setGeneratedBio] = useState<string | null>(null);
  const [generatedIcebreakers, setGeneratedIcebreakers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/bio-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gender,
          profession,
          education,
          religiousPractice,
          prayerHabits,
          hobbies,
          seekingTraits,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setGeneratedBio(data.bio);
        setGeneratedIcebreakers(data.icebreakers || []);
      } else {
        throw new Error(data.error || 'Failed to generate bio.');
      }
    } catch (err: any) {
      console.error('[AI Bio Assistant] Error:', err);
      // Fallback generator
      const fallbackBio = `Alhamdulillah, I am a practicing ${
        gender === 'female' ? 'Muslimah' : 'Muslim brother'
      } working as a ${profession || 'professional'}. I strive to observe my five daily prayers and embody Islamic ethics in all aspects of life. I am firmly committed to a 100% Dowry-Free (Daheej-Free) Nikah rooted in mutual respect, modesty, and family blessing. Seeking a pious, supportive partner to build a righteous home on the Quran and Sunnah.`;
      setGeneratedBio(fallbackBio);
      setGeneratedIcebreakers([
        'How do you balance professional life with daily Salah and Islamic learning?',
        'What are your thoughts on a simple Sunnah wedding with zero dowry expectations?',
        'How do you prefer your Wali and family to be involved in matrimonial discussions?',
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (generatedBio) {
      onApplyBio(generatedBio, generatedIcebreakers);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-zinc-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-emerald-500/30 dark:border-emerald-700/30 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden relative my-auto max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-900 to-teal-900 p-6 text-white relative flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shadow-inner">
              <Sparkles className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">AI Halal Bio & Icebreaker Assistant</h3>
              <p className="text-xs text-emerald-200/90">Craft a respectful, Shariah-compliant matrimonial introduction.</p>
            </div>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-grow text-xs">
          {!generatedBio ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Profession / Career
                  </label>
                  <input
                    type="text"
                    value={profession}
                    onChange={(e) => setProfession(e.target.value)}
                    placeholder="e.g. Software Engineer, Doctor"
                    className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Education Level
                  </label>
                  <input
                    type="text"
                    value={education}
                    onChange={(e) => setEducation(e.target.value)}
                    placeholder="e.g. Master's in CS, Bachelor's"
                    className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Prayer Habits (Salah)
                </label>
                <select
                  value={prayerHabits}
                  onChange={(e) => setPrayerHabits(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                >
                  <option value="Always observes 5 daily prayers">Always observes 5 daily prayers</option>
                  <option value="Regularly prays, striving for Tahajjud">Regularly prays, striving for Tahajjud</option>
                  <option value="Observes prayers, praying at the Masjid">Observes prayers, praying at the Masjid</option>
                  <option value="Prays most prayers, actively improving">Prays most prayers, actively improving</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Hobbies & Interests
                </label>
                <input
                  type="text"
                  value={hobbies}
                  onChange={(e) => setHobbies(e.target.value)}
                  placeholder="e.g. Islamic lectures, charity, fitness, reading"
                  className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Key Qualities Sought in a Spouse
                </label>
                <input
                  type="text"
                  value={seekingTraits}
                  onChange={(e) => setSeekingTraits(e.target.value)}
                  placeholder="e.g. Pious, kind, supportive, zero dowry expectation"
                  className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                />
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                className="w-full mt-2 py-3 px-4 rounded-2xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Crafting Halal Bio & Icebreakers...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Matrimonial Bio</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block font-bold text-zinc-900 dark:text-white mb-1.5 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Generated Halal Bio
                </label>
                <textarea
                  rows={4}
                  value={generatedBio}
                  onChange={(e) => setGeneratedBio(e.target.value)}
                  className="w-full p-3 rounded-2xl border border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20 text-zinc-900 dark:text-white text-xs leading-relaxed"
                />
              </div>

              {generatedIcebreakers.length > 0 && (
                <div>
                  <label className="block font-bold text-zinc-900 dark:text-white mb-1.5 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Custom Halal Icebreakers
                  </label>
                  <div className="space-y-2">
                    {generatedIcebreakers.map((q, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs"
                      >
                        <strong>Q{idx + 1}:</strong> {q}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setGeneratedBio(null)}
                  className="py-2.5 px-3 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300"
                >
                  Adjust Inputs
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="py-2.5 px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Insert into Profile</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
