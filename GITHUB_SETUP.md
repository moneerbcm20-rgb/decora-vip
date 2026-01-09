# تعليمات رفع المشروع على GitHub

## الخطوات المطلوبة:

### 1. إنشاء مستودع جديد على GitHub:
- اذهب إلى: https://github.com/new
- اختر اسمًا للمستودع (مثل: `decora`)
- **لا** تضع علامة على "Initialize this repository with a README"
- اضغط "Create repository"

### 2. بعد إنشاء المستودع، قم بتنفيذ الأوامر التالية:

```bash
# إضافة رابط المستودع (استبدل YOUR_USERNAME و REPO_NAME بالقيم الصحيحة)
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git

# رفع الملفات إلى GitHub
git push -u origin main
```

### مثال:
إذا كان اسم المستخدم `alwershfany` واسم المستودع `decora`:
```bash
git remote add origin https://github.com/alwershfany/decora.git
git push -u origin main
```

## ملاحظات:
- تم إعداد Git بنجاح
- تم إنشاء commit أولي
- تم إضافة ملفات قاعدة البيانات إلى .gitignore (لن يتم رفعها)
- ملفات `node_modules` و `dist` لن يتم رفعها أيضًا
