import PDFDocument from "pdfkit";

interface InvoiceItem {
  medicineName: string;
  sellerShopName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface InvoiceData {
  invoiceId: string;
  transactionId: string;
  customerName: string;
  customerEmail: string;
  orderId: string;
  paymentDate: string;
  items: InvoiceItem[];
  totalAmount: number;
}

export const generateInvoicePdf = async (
  data: InvoiceData,
): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
      });

      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => {
        chunks.push(chunk);
      });

      doc.on("end", () => {
        resolve(Buffer.concat(chunks));
      });

      doc.on("error", (error) => {
        reject(error);
      });

      // Header
      doc.fontSize(24).font("Helvetica-Bold").text("INVOICE", {
        align: "center",
      });

      doc.moveDown(0.5);
      doc.fontSize(10).font("Helvetica").text("Niramoy MedicineStore", {
        align: "center",
      });
      doc.text("Your Health, Our Priority", { align: "center" });

      doc.moveDown(1);

      // Horizontal line
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();

      doc.moveDown(1);

      // Invoice Details
      doc.fontSize(11).font("Helvetica-Bold").text("Invoice Information");
      doc
        .fontSize(10)
        .font("Helvetica")
        .text(`Invoice ID: ${data.invoiceId}`)
        .text(`Order ID: ${data.orderId}`)
        .text(
          `Payment Date: ${new Date(data.paymentDate).toLocaleDateString()}`,
        )
        .text(`Transaction ID: ${data.transactionId}`);

      doc.moveDown(0.8);

      // Customer Information
      doc.fontSize(11).font("Helvetica-Bold").text("Customer Information");
      doc
        .fontSize(10)
        .font("Helvetica")
        .text(`Name: ${data.customerName}`)
        .text(`Email: ${data.customerEmail}`);

      doc.moveDown(1);

      // Horizontal line
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();

      doc.moveDown(1);

      // Amount Table
      const tableTop = doc.y;
      const col1X = 50;
      const col2X = 450;

      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .text("Order Summary", col1X, tableTop);

      doc.moveDown(0.8);

      // Table Header
      const headerY = doc.y;
      doc.fontSize(10).font("Helvetica-Bold");
      doc.text("Description", col1X, headerY);
      doc.text("Amount", col2X, headerY, { align: "right" });

      // Separator line
      doc
        .moveTo(col1X, doc.y)
        .lineTo(col2X + 80, doc.y)
        .stroke();

      doc.moveDown(0.5);

      // Items
      doc.fontSize(10).font("Helvetica");
      for (const item of data.items) {
        const rowY = doc.y;
        const itemLabel = `${item.medicineName} (${item.sellerShopName}) x${item.quantity}`;
        const priceLine = `Unit: ${item.unitPrice.toFixed(2)} BDT`;
        doc.text(itemLabel, col1X, rowY);
        doc.text(`${item.subtotal.toFixed(2)} BDT`, col2X, rowY, {
          align: "right",
        });
        doc.moveDown(0.2);
        doc.fillColor("#666").text(priceLine, col1X);
        doc.fillColor("#000");
        doc.moveDown(0.5);
      }

      doc.moveDown(0.3);

      // Total Row
      const totalY = doc.y;
      doc.fontSize(11).font("Helvetica-Bold");
      doc.text("Total Amount", col1X, totalY);
      doc.text(`${data.totalAmount.toFixed(2)} BDT`, col2X, totalY, {
        align: "right",
      });

      // Separator line
      doc
        .moveTo(col1X, doc.y)
        .lineTo(col2X + 80, doc.y)
        .stroke();

      doc.moveDown(1.5);

      // Footer
      doc
        .fontSize(9)
        .font("Helvetica")
        .text(
          "Thank you for choosing Niramoy MedicineStore. This is an electronically generated invoice.",
          {
            align: "center",
          },
        );

      doc.text(
        "If you have any questions, please contact us at support@niramoy.example.com",
        {
          align: "center",
        },
      );

      doc.text("Payment processed securely through Stripe", {
        align: "center",
      });

      // End the document
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};
