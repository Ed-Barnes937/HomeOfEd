import '../styles/tokens.scss'

import { FridgeDoor } from '../features/board/FridgeDoor.tsx'
import { MagnetView } from '../features/board/MagnetView.tsx'
import { SelectionOverlay } from '../features/board/SelectionOverlay.tsx'
import { toStoredBoard } from '../features/board/serialize.ts'
import { useFridgeBoard } from '../features/board/useFridgeBoard.ts'
import { ShareButton } from '../features/share/ShareButton.tsx'
import { SavedChips } from '../features/toolbar/SavedChips.tsx'
import { TopBar } from '../features/toolbar/TopBar.tsx'
import { Tray } from '../features/tray/Tray.tsx'
import styles from './FridgePage.module.scss'

export function FridgePage() {
  // No options: the hook loads the persisted board (or the seed on first-ever
  // load / corrupt storage) from localStorage itself — see serialize.ts.
  const board = useFridgeBoard()
  const { state } = board
  const selected = state.selId !== null ? state.magnets.find((m) => m.id === state.selId) : undefined
  const storedBoard = toStoredBoard(state.name, state.magnets, state.finish, state.wall)

  const magnetHandlers = {
    onPointerDown: board.onMagnetPointerDown,
    onPointerMove: board.onMagnetPointerMove,
    onPointerUp: board.onMagnetPointerUp,
    onWheel: board.onMagnetWheel,
    onDoubleClick: board.onMagnetDoubleClick,
  }

  return (
    <div className={styles.root} data-testid="fridge-page">
      <div className={styles.light} data-wall={state.wall} />
      <TopBar
        name={state.name}
        onNameChange={board.setName}
        onSave={() => board.save(state.name)}
        onNew={board.newBoard}
        onClear={board.startSweep}
        clearDisabled={state.magnets.length === 0}
        saveDisabled={state.sweeping}
        shareSlot={
          <ShareButton
            board={storedBoard}
            disabled={state.magnets.length === 0 || state.sweeping}
          />
        }
      />
      <SavedChips
        saved={board.saved}
        activeName={state.name}
        onLoad={board.loadSaved}
        onDelete={board.deleteSaved}
        disabled={state.sweeping}
      />
      <div className={styles.stage}>
        <FridgeDoor
          finish={state.finish}
          surfaceRef={board.surfaceRef}
          onSurfacePointerDown={board.onSurfacePointerDown}
        >
          {state.magnets.map((m) => (
            <MagnetView
              key={m.id}
              magnet={m}
              active={state.dragId === m.id}
              departing={state.sweeping}
              surfW={state.surfW}
              surfH={state.surfH}
              handlers={magnetHandlers}
            />
          ))}
          {selected && (
            <SelectionOverlay
              magnet={selected}
              active={state.dragId === selected.id}
              onKnobPointerDown={board.onKnobPointerDown}
              onKnobPointerMove={board.onKnobPointerMove}
              onKnobPointerUp={board.onKnobPointerUp}
              onDelete={board.onMagnetDoubleClick}
            />
          )}
        </FridgeDoor>
      </div>
      <Tray
        finish={state.finish}
        wall={state.wall}
        pick={state.pick}
        onPick={board.setPick}
        onAdd={board.add}
        onFinish={board.setFinish}
        onWall={board.setWall}
        disabled={state.sweeping}
      />
    </div>
  )
}
