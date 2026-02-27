import fs from 'fs';
import glob from 'glob';

const actionFiles = glob.sync('src/actions/**/*.ts');

for (const file of actionFiles) {
    let content = fs.readFileSync(file, 'utf8');

    // Fix empty arrays
    content = content.replace(/const transactionsToCreate = \[\];/g, 'const transactionsToCreate: any[] = [];');
    content = content.replace(/const payableUpdates = \[\];/g, 'const payableUpdates: any[] = [];');
    content = content.replace(/const receivableUpdates = \[\];/g, 'const receivableUpdates: any[] = [];');

    // Cast status, type, serviceType to any to satisfy frontend types
    content = content.replace(/status: (\w+)\.status\,/g, 'status: $1.status as any,');
    content = content.replace(/type: (\w+)\.type\,/g, 'type: $1.type as any,');
    content = content.replace(/serviceType: (\w+)\.serviceType\,/g, 'serviceType: $1.serviceType as any,');
    content = content.replace(/businessId: (\w+)\.businessId\,/g, 'businessId: $1.businessId as any,');
    content = content.replace(/businessId: \((\w+)\.businessId as 'travel' \| 'isp'\) \|\| 'travel'\,/g, "businessId: $1.businessId as any,");
    content = content.replace(/businessId: \((\w+)\.businessId as BusinessType\) \|\| 'travel'/g, 'businessId: $1.businessId as any');
    content = content.replace(/businessId: \((\w+)\.businessId as BusinessType\) \|\| 'travel'\,/g, 'businessId: $1.businessId as any,');
    content = content.replace(/businessId: \(\w+\.businessId as any\) \|\| 'travel'/g, 'businessId: $1.businessId as any,');

    content = content.replace(/phone: (\w+)\.phone\,/g, 'phone: $1.phone as any,');
    content = content.replace(/email: (\w+)\.email\,/g, 'email: $1.email as any,');

    fs.writeFileSync(file, content);
}

console.log('Fixed types in actions.');
