import React from 'react';
import { StudentQRCodeCardModal } from './StudentQRCodeCardModal';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { Student } from '../types';

interface NISNBarcodeProps {
  student?: Student;
  nisn?: string;
  studentName?: string;
  className?: string;
  displayMode?: 'card' | 'scanner';
  onClose?: () => void;
  isOpen?: boolean;
  onScanSuccess?: (student: Student, record: any) => void;
  classes?: any[];
}

export const NISNBarcode: React.FC<NISNBarcodeProps> = (props) => {
  // If a student object or student identifiers (nisn / studentName / displayMode 'card') are provided,
  // render the printable Student QR & Barcode Card Modal
  if (props.student || props.nisn || props.displayMode === 'card') {
    const studentObj: Student = props.student || {
      id: `std-${props.nisn || '1'}`,
      nisn: props.nisn || '0000000000',
      name: props.studentName || 'Siswa',
      className: props.className || '-',
      gender: 'L',
      parentName: '-',
      parentPhone: '-'
    };
    return <StudentQRCodeCardModal student={studentObj} onClose={props.onClose || (() => {})} />;
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
