import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, View } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import HomeScreen from './src/screens/HomeScreen';
import GameScreen from './src/screens/GameScreen';
import GameOverScreen from './src/screens/GameOverScreen';
import { C } from './src/theme';
import type { GameState } from './src/types';
import {
  DEFAULT_SETTINGS,
  loadRuns,
  loadSettings,
  saveRun,
  saveSettings,
  toRecord,
  type RunRecord,
  type Settings,
} from './src/storage';
import * as fb from './src/feedback';

type Route = 'home' | 'game' | 'over';

export default function App() {
  const [route, setRoute] = useState<Route>('home');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [finished, setFinished] = useState<GameState | null>(null);
  /** Snapshot of the history from before the finished run, for "new best". */
  const [priorRuns, setPriorRuns] = useState<RunRecord[]>([]);
  /** Bumped on every start so the game screen remounts with a clean engine. */
  const [runKey, setRunKey] = useState(0);
  const runsRef = useRef<RunRecord[]>([]);
  runsRef.current = runs;

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(C.void).catch(() => {});
    loadSettings().then((loaded) => {
      setSettings(loaded);
      fb.setEnabled(loaded);
    });
    loadRuns().then(setRuns);
  }, []);

  const changeSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      fb.setEnabled(next);
      return next;
    });
  }, []);

  const start = useCallback(() => {
    setFinished(null);
    setRunKey((k) => k + 1);
    setRoute('game');
  }, []);

  const finish = useCallback((state: GameState) => {
    // Snapshot first: saveRun resolves after the summary has already rendered,
    // so the screen must not have to guess which record is the new one.
    setPriorRuns(runsRef.current);
    setFinished(state);
    saveRun(toRecord(state)).then(setRuns);
    setRoute('over');
  }, []);

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="light" />
        {route === 'home' && (
          <HomeScreen
            settings={settings}
            runs={runs}
            onChangeSettings={changeSettings}
            onStart={start}
          />
        )}
        {route === 'game' && (
          <GameScreen
            key={runKey}
            difficulty={settings.difficulty}
            settings={settings}
            onFinish={finish}
            onAbort={() => setRoute('home')}
          />
        )}
        {route === 'over' && finished && (
          <GameOverScreen
            state={finished}
            priorRuns={priorRuns}
            onAgain={start}
            onHome={() => setRoute('home')}
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
});
