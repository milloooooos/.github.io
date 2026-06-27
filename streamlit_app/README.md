# DOT 用药时长分析工具 (Streamlit 版)

基于 Streamlit 的销售数据 DOT (Duration of Treatment) 分析工具，用于分析特定时间段内购药患者的用药时长指标。

## ✨ 功能特性

- **文件上传**：支持 Excel (.xlsx, .xls) 和 CSV 格式，拖拽或点击上传
- **自动识别字段**：系统自动匹配患者标识、购药时间、购药数量等列
- **时间范围筛选**：自定义选择起始月份和结束月份
- **DOT 计算**：自动计算去重患者数、累计购药总支数和 DOT 值
- **全量统计**：统计范围覆盖患者从首次购药至最新数据的全部记录
- **数据可视化**：
  - 📊 月度购药趋势图（柱状图 + 活跃患者折线图）
  - 📊 月度 DOT 对比图
  - 📊 患者购药支数分布图
- **明细表格**：分页查看，支持排序
- **结果导出**：支持 CSV 和 Excel 格式导出
- **响应式设计**：兼容桌面端和移动端

## 📐 DOT 计算逻辑

```
DOT = 累计购药总支数 / 去重患者数
```

1. 用户选择时间段（如 2024年1月 ~ 2024年6月）
2. 筛选出该时间段内有购药记录的去重患者
3. 对这些患者，统计其从**首次购药**至**最新数据**的全部购药总支数
4. DOT = 累计购药总支数 ÷ 去重患者数

**示例**：去重患者 10 人，累计购药 100 支，则 DOT = 10

## 🚀 部署方式

### 方式一：Streamlit Community Cloud（免费，推荐）

1. 将本仓库 Fork 或推送到你的 GitHub
2. 访问 [https://share.streamlit.io/](https://share.streamlit.io/)
3. 点击 **New app**
4. 选择你的 GitHub 仓库
5. **Main file path** 填写：`streamlit_app.py`
6. 点击 **Deploy** — 等待 1-2 分钟即可上线

### 方式二：本地运行

```bash
# 1. 克隆仓库
git clone https://github.com/你的用户名/dot-analysis-streamlit.git
cd dot-analysis-streamlit

# 2. 安装依赖
pip install -r requirements.txt

# 3. 启动应用
streamlit run streamlit_app.py
```

浏览器自动打开 `http://localhost:8501`

### 方式三：Docker 部署

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8501
CMD ["streamlit", "run", "streamlit_app.py", "--server.port=8501", "--server.address=0.0.0.0"]
```

```bash
docker build -t dot-analysis .
docker run -p 8501:8501 dot-analysis
```

## 📁 项目结构

```
dot-analysis-streamlit/
├── streamlit_app.py      # 主应用文件
├── requirements.txt      # Python 依赖
├── .streamlit/
│   └── config.toml       # Streamlit 主题与配置
└── README.md             # 项目说明
```

## 🔧 字段自动识别

工具会自动识别以下字段（支持中英文）：

| 字段 | 关键词 |
|------|--------|
| 患者标识 | 会员号、患者ID、患者编号、卡号 |
| 购药时间 | 销售时间、购药时间、购买时间、日期 |
| 购药数量 | 销售数量、购药数量、数量、支数 |
| 患者姓名 | 会员姓名、患者姓名、姓名（可选）|

## 🛠 技术栈

- [Streamlit](https://streamlit.io/) - Web 应用框架
- [Pandas](https://pandas.pydata.org/) - 数据处理
- [Plotly](https://plotly.com/) - 交互式图表
- [openpyxl](https://openpyxl.readthedocs.io/) - Excel 文件读写

## 📌 浏览器兼容性

支持所有现代浏览器（Chrome、Firefox、Edge、Safari）

## 🔒 数据安全

所有数据在浏览器/服务器本地处理，不会上传至第三方服务器。使用 Streamlit Community Cloud 部署时，数据仅在你自己的会话中处理。
