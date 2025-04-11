import { makeStyles, shorthands, Title3, Text, Card, CardHeader } from "@fluentui/react-components"

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("16px"),
  },
  card: {
    width: "100%",
  },
  section: {
    marginBottom: "24px",
  },
})

interface PlaceholderSettingsProps {
  categoryId: string
  categoryName: string
}

const PlaceholderSettings = ({ categoryId, categoryName }: PlaceholderSettingsProps) => {
  const styles = useStyles()

  return (
    <div className={styles.root}>
      <div className={styles.section}>
        <Title3>{categoryName} Settings</Title3>
        <Text>This section will contain {categoryName.toLowerCase()} settings.</Text>
        <Card className={styles.card}>
          <CardHeader header={`${categoryName} Configuration`} />
          <div style={{ padding: "16px" }}>
            <Text>
              The {categoryName.toLowerCase()} settings will be implemented here. This is a placeholder for the {categoryId} category.
            </Text>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default PlaceholderSettings
