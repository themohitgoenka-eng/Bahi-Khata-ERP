import React from 'react';
import { FullAccountGroupModal } from '../master/FullAccountGroupModal';
import { AccountGroup } from '../../types';

interface QuickCreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (newGroup: AccountGroup) => void;
}

/**
 * Upgraded QuickCreateGroupModal:
 * Forwards directly to the FullAccountGroupModal to ensure 100% original, complete master fields
 * with parent selection and auto-nature logic.
 */
export const QuickCreateGroupModal: React.FC<QuickCreateGroupModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  return (
    <FullAccountGroupModal
      isOpen={isOpen}
      onClose={onClose}
      onCreated={onCreated}
    />
  );
};
