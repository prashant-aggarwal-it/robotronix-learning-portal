import type {LearningStatus} from '@/lib/types';
import {learningSignalLabel} from '@/lib/display';
export function StatusPill({status}:{status:LearningStatus}){
  const cls=status==='on_track'?'green':status==='reinforce'?'amber':'red';
  const dot=status==='on_track'?'●':status==='reinforce'?'◆':'▲';
  return <span className={`pill ${cls}`}><span>{dot}</span>{learningSignalLabel(status)}</span>;
}
