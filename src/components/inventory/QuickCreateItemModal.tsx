import React from 'react';
import { InventoryItem } from '../../types';
import { FullItemMasterModal } from '../master/FullItemMasterModal';

interface QuickCreateItemModalProps {
  isOpen: boolean;
  initialName?: string;
  onClose: () => void;
  onCreated: (createdItem: InventoryItem) => void;
}

export const QuickCreateItemModal: React.FC<QuickCreateItemModalProps> = ({
  isOpen,
  initialName = '',
  onClose,
  onCreated,
}) => {
  return (
    <FullItemMasterModal
      isOpen={isOpen}
      initialName={initialName}
      onClose={onClose}
      onCreated={onCreated}
    />
  );
};
