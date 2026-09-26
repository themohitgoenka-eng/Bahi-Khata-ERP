import React from 'react';
import { Ledger } from '../../types';
import { FullLedgerMasterModal } from '../master/FullLedgerMasterModal';

interface QuickCreateLedgerModalProps {
  isOpen?: boolean;
  initialName?: string;
  defaultGroupId?: string;
  onClose: () => void;
  onCreated: (createdLedger: Ledger) => void;
}

export const QuickCreateLedgerModal: React.FC<QuickCreateLedgerModalProps> = ({
  isOpen = true,
  initialName = '',
  defaultGroupId,
  onClose,
  onCreated,
}) => {
  return (
    <FullLedgerMasterModal
      isOpen={isOpen}
      initialName={initialName}
      defaultGroupId={defaultGroupId}
      onClose={onClose}
      onCreated={onCreated}
    />
  );
};
