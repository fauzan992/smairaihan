import React from 'react';
import { StudentQRCodeCardModal } from './StudentQRCodeCardModal';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { Student } from '../types';

interface NISNBarcodeProps {
  student?: Student;
  onClose?: () => void;
  isOpen?: boolean;
  onScanSuccess?: (student: Student, record: any) => void;
  classes?: any[];
}

export const NISNBarcode: React.FC<NISNBarcodeProps> = (props) => {
  if (props.student) {
    return <StudentQRCodeCardModal student={props.student} onClose={props.onClose || (() => {})} />;
  }
  return (
    <BarcodeScannerModal
      isOpen={props.isOpen !== undefined ? props.isOpen : true}
      onClose={props.onClose || (() => {})}
      onScanSuccess={props.onScanSuccess || (() => {})}
      classes={props.classes || []}
    />
  );
};

export default NISNBarcode;
