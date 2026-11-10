import '../styles/tokens.scss'

import { useBoardStorage } from '../features/board/BoardStorageContext.tsx'
import { FridgeDoor } from '../features/board/FridgeDoor.tsx'
import { LandscapeNudge } from '../features/board/LandscapeNudge.tsx'
import { MagnetView } from '../features/board/MagnetView.tsx'
import { SelectionOverlay } from '../features/board/SelectionOverlay.tsx'
import { type StoredBoard, toStoredBoard } from '../features/board/serialize.ts'
import { useBoardView } from '../features/board/useBoardView.ts'
import { useFridgeBoard } from '../features/board/useFridgeBoard.ts'
import { ShareButton } from '../features/share/ShareButton.tsx'
import { MobileBar } from '../features/toolbar/MobileBar.tsx'
import { PlayerChip } from '../features/toolbar/PlayerChip.tsx'
import { SavedChips } from '../features/toolbar/SavedChips.tsx'
import { TopBar } from '../features/toolbar/TopBar.tsx'
import { AddPanel } from '../features/tray/AddPanel.tsx'
import { useFamilySession } from '../session/FamilySessionContext.tsx'
import { Tray } from '../features/tray/Tray.tsx'
import { useIsMobile } from '../useIsMobile.ts'
import styles from './FridgePage.module.scss'

interface FridgePageProps {
  /** A shared fridge (`/b/<id>`): offers Keep at this address, and nothing that saves. */
  keepHref?: string
  /** Called with the board as it is now when Keep is pressed, before the page leaves. */
  onKeep?: (current: StoredBoard) => void
}

export function FridgePage({ keepHref, onKeep }: FridgePageProps = {}) {
  // The hook loads the persisted board (or the seed on first-ever load /
  // corrupt storage) from the storage the route provides (see serialize.ts).
  const board = useFridgeBoard(useBoardStorage())
  const session = useFamilySession()
  const playerName = keepHref === undefined ? session?.name : undefined
  const view = useBoardView()
  const mobile = useIsMobile()
  const { state } = board
  const selected = state.selId !== null ? state.magnets.find((m) => m.id === state.selId) : undefined
  const storedBoard = toStoredBoard(state.name, state.magnets, state.finish, state.wall)

  const shareButton = (
    <ShareButton board={storedBoard} disabled={state.magnets.length === 0 || state.sweeping} />
  )

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
      {mobile ? (
        <MobileBar
          name={state.name}
          onNameChange={board.setName}
          onSave={() => board.save(state.name)}
          onNew={board.newBoard}
          onClear={board.startSweep}
          clearDisabled={state.magnets.length === 0}
          saveDisabled={state.sweeping}
          shareSlot={shareButton}
          saved={board.saved}
          onLoad={board.loadSaved}
          onDelete={board.deleteSaved}
          playerName={playerName}
          keepHref={keepHref}
          onKeep={() => onKeep?.(storedBoard)}
        />
      ) : (
        <>
          <TopBar
            name={state.name}
            onNameChange={board.setName}
            onSave={() => board.save(state.name)}
            onNew={board.newBoard}
            onClear={board.startSweep}
            clearDisabled={state.magnets.length === 0}
            saveDisabled={state.sweeping}
            shareSlot={shareButton}
            playerSlot={playerName !== undefined && <PlayerChip name={playerName} />}
            keepHref={keepHref}
            onKeep={() => onKeep?.(storedBoard)}
          />
          {keepHref === undefined && (
            <SavedChips
              saved={board.saved}
              activeName={state.name}
              onLoad={board.loadSaved}
              onDelete={board.deleteSaved}
              disabled={state.sweeping}
            />
          )}
        </>
      )}
      <div
        className={styles.stage}
        ref={view.stageRef}
        onPointerDown={view.onPointerDown}
        onPointerMove={view.onPointerMove}
        onPointerUp={view.onPointerUp}
        onPointerCancel={view.onPointerUp}
      >
        <div className={styles.scaler} style={{ transform: view.transform }}>
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
        {view.showReset && (
          <button type="button" className={styles.reset} onClick={view.reset}>
            Fit
          </button>
        )}
      </div>
      {mobile ? (
        <AddPanel
          finish={state.finish}
          wall={state.wall}
          pick={state.pick}
          onPick={board.setPick}
          onAdd={board.add}
          onFinish={board.setFinish}
          onWall={board.setWall}
          disabled={state.sweeping}
        />
      ) : (
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
      )}
      <LandscapeNudge />
    </div>
  )
}
