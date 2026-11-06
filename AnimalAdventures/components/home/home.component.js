import React from 'react';
import { StatusBar } from 'expo-status-bar';
import AnimalScreen from '../animals/animal.screen.component.jsx';
import { tapFeedback } from '../../utils/haptics';
import { useBackToMenu } from '../../utils/navigation';
import { GameScreen } from '../utility/game-screen.component';
import { useInstructionPrompt } from '../../utils/use-instruction-prompt';
import { t } from '../../constants';

function HomeScreen({
  currentLanguage,
  setCurrentLanguage,
  onBackToMenu,
  onNextGame,
}) {
  // Spoken once when the mode opens; tapping the instruction replays it.
  const { replay: replayInstruction } = useInstructionPrompt(
    'learn',
    currentLanguage
  );

  const handleBackToMenu = () => {
    tapFeedback();
    onBackToMenu();
  };

  useBackToMenu(handleBackToMenu);

  return (
    <>
      <GameScreen
        currentLanguage={currentLanguage}
        setCurrentLanguage={setCurrentLanguage}
        onHome={handleBackToMenu}
        onNextGame={onNextGame}
        instruction={t(currentLanguage, 'modeLearnDescription')}
        onReplayInstruction={replayInstruction}
      >
        <AnimalScreen currentLanguage={currentLanguage} />
      </GameScreen>
      <StatusBar style="light" />
    </>
  );
}

export default HomeScreen;
