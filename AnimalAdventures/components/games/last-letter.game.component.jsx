import React from 'react';
import FirstLetterGame from './first-letter.game.component.jsx';

/**
 * "Guess the Last Letter": the same game as "Guess the First Letter", asked
 * about the other end of the animal's name. It shares that screen outright -
 * layout, audio, hints, rewards - so the two always look and behave alike,
 * and only what the letter is measured from differs (see the `position` prop).
 */
export default function LastLetterGame(props) {
  return <FirstLetterGame {...props} position="last" />;
}
