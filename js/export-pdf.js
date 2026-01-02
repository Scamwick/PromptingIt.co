async function exportPromptPDF(promptData) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Styling Constants
    const margin = 20;
    const lineHeight = 10;
    const pageHeight = doc.internal.pageSize.height;
    let y = 20;

    // Helper: Check Page Break
    function checkPageBreak(addHeight) {
        if (y + addHeight > pageHeight - margin) {
            doc.addPage();
            y = 20;
        }
    }

    // 1. Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("PromptingIt.co Report", margin, y);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 150, y);
    y += 15;

    // Drawing a separator line
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, 190, y);
    y += 15;

    // 2. Prompt Title & Price
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(promptData.title, margin, y);
    doc.setFontSize(14);
    doc.setTextColor(46, 204, 113);
    doc.text(`$${promptData.price}`, 170, y);
    doc.setTextColor(0, 0, 0);
    y += 10;

    // 3. Stats Section (Background Box)
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y, 170, 25, 'F');
    y += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    // Stats Grid
    const statX = [margin + 10, margin + 60, margin + 110];
    doc.text(`Views: ${promptData.stats.views}`, statX[0], y);
    doc.text(`Sales: ${promptData.stats.sales}`, statX[1], y);
    doc.text(`Rating: ${promptData.stats.rating} / 5.0`, statX[2], y);
    y += 8;
    doc.text(`Category: ${promptData.category}`, statX[0], y);
    doc.text(`Model: ${promptData.model}`, statX[1], y);
    y += 15;

    // 4. Description
    y += 10;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Description", margin, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const splitDesc = doc.splitTextToSize(promptData.description, 170);
    checkPageBreak(splitDesc.length * 5);
    doc.text(splitDesc, margin, y);
    y += splitDesc.length * 5 + 10;

    // 5. Prompt Content (The Code/Text)
    checkPageBreak(40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Prompt Content", margin, y);
    y += 7;
    doc.setFont("courier", "normal");
    doc.setFontSize(10);
    doc.setFillColor(240, 240, 240);
    const splitPrompt = doc.splitTextToSize(promptData.content, 160);
    const blockHeight = (splitPrompt.length * 6) + 10;
    checkPageBreak(blockHeight);
    doc.rect(margin, y, 170, blockHeight, 'F');
    doc.text(splitPrompt, margin + 5, y + 8);
    y += blockHeight + 15;

    // 6. Version History
    checkPageBreak(30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Version History", margin, y);
    y += 10;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Ver", margin, y);
    doc.text("Date", margin + 20, y);
    doc.text("Change Note", margin + 60, y);
    y += 2;
    doc.line(margin, y, 190, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    promptData.versionHistory.forEach(ver => {
        checkPageBreak(10);
        doc.text(ver.version, margin, y);
        doc.text(ver.date, margin + 20, y);
        doc.text(ver.note, margin + 60, y);
        y += 8;
    });

    // Save
    doc.save(`${promptData.title.replace(/\s+/g, '_')}_Report.pdf`);
    Toast.success('PDF downloaded successfully!');
}
